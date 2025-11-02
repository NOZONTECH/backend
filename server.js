const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Подключение к базе данных
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/nozon', {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('Connected to MongoDB'))
.catch(err => console.error('MongoDB connection error:', err));

// Статические файлы (если нужно)
app.use(express.static(path.join(__dirname, '../frontend')));

// API маршруты
app.use('/api/auth', require('./routes/auth'));
app.use('/api/lots', require('./routes/lots'));
app.use('/api/messages', require('./routes/messages'));
app.use('/api/profile', require('./routes/profile'));

// Заглушка для SPA (React/Vue/Angular)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
