const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcrypt');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Хеш пароля админа
const ADMIN_PASSWORD = 'T#11RFiO';
let adminHash = null;
bcrypt.hash(ADMIN_PASSWORD, 10).then(hash => adminHash = hash);

// Простая "аутентификация" через заголовок (для демо)
function requireAdmin(req, res, next) {
  const auth = req.headers.authorization;
  if (auth !== 'admin-session') {
    return res.status(403).json({ error: 'Доступ запрещён' });
  }
  next();
}

// === Публичные маршруты ===
app.post('/api/admin/login', async (req, res) => {
  const { password } = req.body;
  if (!adminHash || !(await bcrypt.compare(password, adminHash))) {
    return res.status(401).json({ error: 'Неверный пароль' });
  }
  // Возвращаем "сессию" (в реальном проекте — JWT)
  res.json({ success: true, token: 'admin-session' });
});

// === Защищённые маршруты (админка) ===
app.get('/api/admin/lots', requireAdmin, async (req, res) => {
  const { data, error } = await supabase.from('lots').select('*').order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.post('/api/admin/lots', requireAdmin, async (req, res) => {
  const { title, description, start_price, reserve_price, duration_hours, is_premium } = req.body;
  const ends_at = new Date(Date.now() + duration_hours * 60 * 60 * 1000);

  const { data, error } = await supabase.from('lots').insert({
    user_id: '00000000-0000-0000-0000-000000000000', // временный ID админа
    title,
    description,
    start_price,
    reserve_price,
    duration_hours,
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

// === Запуск ===
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('Backend запущен'));
