const express = require('express');
const User = require('../models/User');
const Lot = require('../models/Lot');
const Message = require('../models/Message');
const ActivityLog = require('../models/ActivityLog');

const router = express.Router();

// Получить профиль
router.get('/', async (req, res) => {
  try {
    const { userId } = req.query;

    const user = await User.findById(userId).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'Пользователь не найден' });
    }

    const userLots = await Lot.find({ userId }).sort({ createdAt: -1 });
    const receivedMessages = await Message.find({ toUserId: userId }).populate('fromUserId', 'email');
    const sentMessages = await Message.find({ fromUserId: userId }).populate('toUserId', 'email');
    const activityLogs = await ActivityLog.find({ userId }).sort({ date: -1 });

    res.json({
      user,
      lots: userLots,
      messages: {
        received: receivedMessages,
        sent: sentMessages
      },
      activity: activityLogs
    });
  } catch (error) {
    res.status(500).json({ message: 'Ошибка сервера', error: error.message });
  }
});

// Обновить профиль
router.put('/', async (req, res) => {
  try {
    const { userId } = req.body;
    const updates = req.body;

    const user = await User.findByIdAndUpdate(userId, updates, { new: true }).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'Пользователь не найден' });
    }

    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Ошибка сервера', error: error.message });
  }
});

module.exports = router;
