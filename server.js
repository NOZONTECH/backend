const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcrypt');
const cors = require('cors');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

// Multer — для файлов
const upload = multer({
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 МБ
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Только изображения!'));
  }
});

// Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Хеш админа
const ADMIN_PASSWORD = 'T#11RFiO';
let adminHash = null;
bcrypt.hash(ADMIN_PASSWORD, 10).then(hash => adminHash = hash);

// Админ-аутентификация (упрощённо)
function requireAdmin(req, res, next) {
  if (req.headers.authorization !== 'admin-session') {
    return res.status(403).json({ error: 'Доступ запрещён' });
  }
  next();
}

// === Публичные маршруты ===

app.post('/api/register', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email и пароль обязательны' });
  const { data: existing } = await supabase.from('users').select().eq('email', email);
  if (existing.length > 0) return res.status(409).json({ error: 'Email занят' });
  const hash = await bcrypt.hash(password, 10);
  const { data, error } = await supabase.from('users').insert({ email, password: hash }).select();
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true, user: data[0] });
});

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  const { data, error } = await supabase.from('users').select().eq('email', email);
  if (error || data.length === 0) return res.status(401).json({ error: 'Неверный email' });
  const user = data[0];
  const valid = await bcrypt.compare(password, user.password);
  if (!valid) return res.status(401).json({ error: 'Неверный пароль' });
  res.json({ success: true, user: { id: user.id, email: user.email } });
});

app.post('/api/admin/login', async (req, res) => {
  const { password } = req.body;
  if (!adminHash || !(await bcrypt.compare(password, adminHash))) {
    return res.status(401).json({ error: 'Неверный пароль' });
  }
  res.json({ success: true, token: 'admin-session' });
});

// === Создание лота (с фото) ===
app.post('/api/lots', upload.array('images', 3), async (req, res) => {
  const { title, description, start_price, reserve_price, duration_hours, user_id } = req.body;
  const files = req.files;

  if (!user_id || !title || !start_price || !reserve_price || !files || files.length === 0) {
    return res.status(400).json({ error: 'Все поля и фото обязательны' });
  }

  try {
    // Загружаем фото в Supabase Storage
    const imageUrls = [];
    for (const file of files) {
      const fileName = `${uuidv4()}${path.extname(file.originalname)}`;
      const { data, error } = await supabase.storage
        .from('lot-images')
        .upload(`public/${fileName}`, file.buffer, {
          contentType: file.mimetype,
          upsert: false
        });
      if (error) throw error;
      const publicUrl = supabase.storage.from('lot-images').getPublicUrl(`public/${fileName}`).data.publicUrl;
      imageUrls.push(publicUrl);
    }

    // Создаём лот
    const ends_at = new Date(Date.now() + duration_hours * 60 * 60 * 1000);
    const { data, error } = await supabase.from('lots').insert({
      user_id,
      title,
      description,
      start_price: parseFloat(start_price),
      reserve_price: parseFloat(reserve_price),
      duration_hours: parseInt(duration_hours),
      ends_at,
      images: imageUrls,
      is_active: true,
      is_premium: false
    }).select();

    if (error) throw error;
    res.json({ success: true, lot: data[0] });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка при создании лота' });
  }
});
// Защищённый маршрут для очистки (только по секретному ключу)
app.post('/api/cron/cleanup', async (req, res) => {
  const token = req.headers['x-cron-secret'];
  if (token !== process.env.CRON_SECRET) {
    return res.status(403).json({ error: 'Доступ запрещён' });
  }

  try {
    // Находим завершённые лоты
    const { data: expiredLots, error } = await supabase
      .from('lots')
      .select('id, images')
      .lt('ends_at', new Date().toISOString())
      .eq('is_active', true);

    if (error) throw error;

    if (expiredLots.length === 0) {
      return res.json({ message: 'Нет завершённых лотов' });
    }

    // Удаляем фото из Storage
    for (const lot of expiredLots) {
      if (lot.images) {
        const paths = lot.images.map(url => {
          const match = url.match(/public\/([^?]+)/);
          return match ? match[1] : null;
        }).filter(Boolean);
        if (paths.length > 0) {
          await supabase.storage.from('lot-images').remove(paths);
        }
      }
    }

    // Деактивируем лоты (или удаляем — решай сам)
    const lotIds = expiredLots.map(l => l.id);
    await supabase.from('lots').update({ is_active: false }).in('id', lotIds);

    res.json({ deleted: lotIds.length });
  } catch (err) {
    console.error('Очистка не удалась:', err);
    res.status(500).json({ error: err.message });
  }
});
// === Админка ===
app.get('/api/admin/lots', requireAdmin, async (req, res) => {
  const { data, error } = await supabase.from('lots').select('*').order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.post('/api/admin/lots', requireAdmin, async (req, res) => {
  const { title, description, start_price, reserve_price, duration_hours, is_premium } = req.body;
  const ends_at = new Date(Date.now() + duration_hours * 60 * 60 * 1000);
  const { data, error } = await supabase.from('lots').insert({
    user_id: '00000000-0000-0000-0000-000000000000',
    title,
    description,
    start_price: parseFloat(start_price),
    reserve_price: parseFloat(reserve_price),
    duration_hours: parseInt(duration_hours),
    ends_at,
    is_active: true,
    is_premium
  }).select();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data[0]);
});

app.delete('/api/admin/lots/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { error } = await supabase.from('lots').delete().eq('id', id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

const PORT = process.env.PORT || 3000;
// Telegram Webhook
app.post('/telegram/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const update = JSON.parse(req.body.toString());
  if (update.message?.text === '/start') {
    const { id: telegram_id, username, first_name } = update.message.from;
    // Сохраняем или обновляем пользователя
    const { data: existing } = await supabase
      .from('users')
      .select()
      .eq('telegram_id', String(telegram_id));

    if (existing.length === 0) {
      await supabase.from('users').insert({
        telegram_id: String(telegram_id),
        email: null,
        password: null
      });
    }
    // Отправляем приветствие
    const msg = '✅ Вы зарегистрированы! Перейдите на сайт и нажмите "Войти через Telegram".';
    await fetch(`https://api.telegram.org/8274197381:AAG86fI_EptHDEguDVOSrUzFJJ6pMq1kIZk/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: telegram_id, text: msg })
    });
  }
  res.sendStatus(200);
});
// Получить лоты пользователя
app.get('/api/users/:user_id/lots', async (req, res) => {
  const { user_id } = req.params;
  const { data, error } = await supabase
    .from('lots')
    .select('*')
    .eq('user_id', user_id)
    .order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// Проверка лимита перед созданием лота (внутри маршрута /api/lots)
// Замени старый блок app.post('/api/lots', ...) на этот:

app.post('/api/lots', upload.array('images', 3), async (req, res) => {
  const { title, description, start_price, reserve_price, duration_hours, user_id } = req.body;
  const files = req.files;

  if (!user_id || !title || !start_price || !reserve_price || !files || files.length === 0) {
    return res.status(400).json({ error: 'Все поля и фото обязательны' });
  }

  try {
    // Проверяем лимит
    const { data: activeLots, error: countError } = await supabase
      .from('lots')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user_id)
      .eq('is_active', true);

    if (countError) throw countError;

    const lotCount = activeLots.count;
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('is_premium')
      .eq('id', user_id)
      .single();

    if (userError) throw userError;

    const maxLots = user.is_premium ? 20 : 5;
    if (lotCount >= maxLots) {
      return res.status(403).json({ 
        error: `Достигнут лимит лотов (${maxLots}). Купите Premium для увеличения.` 
      });
    }

    // Загрузка фото
    const imageUrls = [];
    for (const file of files) {
      const fileName = `${uuidv4()}${path.extname(file.originalname)}`;
      const { data, error } = await supabase.storage
        .from('lot-images')
        .upload(`public/${fileName}`, file.buffer, {
          contentType: file.mimetype,
          upsert: false
        });
      if (error) throw error;
      const publicUrl = supabase.storage.from('lot-images').getPublicUrl(`public/${fileName}`).data.publicUrl;
      imageUrls.push(publicUrl);
    }

    // Создание лота
    const ends_at = new Date(Date.now() + duration_hours * 60 * 60 * 1000);
    const { data, error } = await supabase.from('lots').insert({
      user_id,
      title,
      description,
      start_price: parseFloat(start_price),
      reserve_price: parseFloat(reserve_price),
      duration_hours: parseInt(duration_hours),
      ends_at,
      images: imageUrls,
      is_active: true,
      is_premium: false
    }).select();

    if (error) throw error;
    res.json({ success: true, lot: data[0] });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка при создании лота' });
  }
});
app.listen(PORT, () => console.log('Backend запущен'));
