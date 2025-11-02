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
app.listen(PORT, () => console.log('Backend запущен'));
