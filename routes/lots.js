const express = require('express');
const Lot = require('../models/Lot');
const User = require('../models/User');
const ActivityLog = require('../models/ActivityLog');

const router = express.Router();

// Получить лоты
router.get('/', async (req, res) => {
  try {
    const { type } = req.query;
    let query = {};
    if (type) {
      query.type = type;
    }

    const lots = await Lot.find(query).populate('userId', 'email').sort({ createdAt: -1 }).limit(10);
    res.json(lots);
  } catch (error) {
    res.status(500).json({ message: 'Ошибка сервера', error: error.message });
  }
});

// Создать лот
router.post('/', async (req, res) => {
  try {
    const { userId, type, title, price, buyNowPrice, description, tags, images, isPremium, location } = req.body;

    const lot = new Lot({
      userId,
      type,
      title,
      price,
      buyNowPrice,
      description,
      tags,
      images,
      isPremium,
      location
    });

    await lot.save();

    // Записываем действие
    const activity = new ActivityLog({
      userId,
      action: 'created',
      targetId: lot._id
    });
    await activity.save();

    res.status(201).json(lot);
  } catch (error) {
    res.status(500).json({ message: 'Ошибка сервера', error: error.message });
  }
});

// Обновить лот
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const lot = await Lot.findById(id);
    if (!lot) {
      return res.status(404).json({ message: 'Лот не найден' });
    }

    Object.assign(lot, updates);
    await lot.save();

    // Записываем действие
    const activity = new ActivityLog({
      userId: lot.userId,
      action: 'edited',
      targetId: lot._id
    });
    await activity.save();

    res.json(lot);
  } catch (error) {
    res.status(500).json({ message: 'Ошибка сервера', error: error.message });
  }
});

// Удалить лот
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const lot = await Lot.findByIdAndDelete(id);
    if (!lot) {
      return res.status(404).json({ message: 'Лот не найден' });
    }

    // Записываем действие
    const activity = new ActivityLog({
      userId: lot.userId,
      action: 'deleted',
      targetId: lot._id
    });
    await activity.save();

    res.json({ message: 'Лот удалён' });
  } catch (error) {
    res.status(500).json({ message: 'Ошибка сервера', error: error.message });
  }
});

// Сделать ставку
router.post('/:id/bid', async (req, res) => {
  try {
    const { id } = req.params;
    const { userId, amount } = req.body;

    const lot = await Lot.findById(id);
    if (!lot) {
      return res.status(404).json({ message: 'Лот не найден' });
    }

    lot.bids.push({
      userId,
      amount,
      date: new Date()
    });

    await lot.save();

    res.json(lot);
  } catch (error) {
    res.status(500).json({ message: 'Ошибка сервера', error: error.message });
  }
});

module.exports = router;
