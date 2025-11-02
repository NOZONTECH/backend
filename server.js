const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Инициализация Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Middleware
app.use(cors());
app.use(express.json());

// Статические файлы
app.use(express.static(path.join(__dirname, '../frontend')));

// API маршруты
app.use('/api/auth', require('./routes/auth'));
app.use('/api/lots', require('./routes/lots'));
app.use('/api/messages', require('./routes/messages'));
app.use('/api/profile', require('./routes/profile'));

// Заглушка для SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
