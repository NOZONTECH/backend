const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcrypt');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// === Supabase ===
const supabaseUrl = process.env.SUPABASE_URL || 'YOUR_SUPABASE_URL';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || 'YOUR_SUPABASE_ANON_KEY';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// === Хеширование пароля админа (один раз!) ===
const ADMIN_PASSWORD = 'T#11RFiO'; // никогда не хранить в коде в продакшене!
let adminHash = null;

bcrypt.hash(ADMIN_PASSWORD, 10).then(hash => {
  adminHash = hash;
  console.log('Админ-хеш готов');
});

// === Маршруты ===

// Регистрация (упрощённо — только email)
app.post('/api/register', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email и пароль обязательны' });

  const { data: existing } = await supabase.from('users').select().eq('email', email);
  if (existing.length > 0) return res.status(409).json({ error: 'Email уже занят' });

  const hash = await bcrypt.hash(password, 10);
  const { data, error } = await supabase.from('users').insert({ email, password: hash });
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true, user: data[0] });
});

// Логин
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  const { data, error } = await supabase.from('users').select().eq('email', email);
  if (error || data.length === 0) return res.status(401).json({ error: 'Неверный email' });

  const user = data[0];
  const valid = await bcrypt.compare(password, user.password);
  if (!valid) return res.status(401).json({ error: 'Неверный пароль' });

  res.json({ success: true, user: { id: user.id, email: user.email, is_admin: user.is_admin } });
});

// Админ-логин (пароль в теле)
app.post('/api/admin/login', async (req, res) => {
  const { password } = req.body;
  if (!adminHash) return res.status(500).json({ error: 'Сервер не готов' });
  const valid = await bcrypt.compare(password, adminHash);
  if (!valid) return res.status(401).json({ error: 'Неверный пароль' });

  // Найдём или создадим админа
  const { data } = await supabase.from('users').select().eq('is_admin', true);
  let admin = data[0];
  if (!admin) {
    const { data: newAdmin } = await supabase.from('users').insert({
      email: 'admin@auction.com',
      password: adminHash,
      is_admin: true
    }).select();
    admin = newAdmin[0];
  }
  res.json({ success: true, user: { id: admin.id, is_admin: true } });
});

// === Запуск ===
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Сервер запущен на порту ${PORT}`);
});
