const express = require('express');
const Message = require('../models/Message');

const router = express.Router();

// Получить сообщения
router.get('/', async (req, res) => {
  try {
    const { toUserId, fromUserId } = req.query;
    let query = {};
    if (toUserId) query.toUserId = toUserId;
    if (fromUserId) query.fromUserId = fromUserId;

    const messages = await Message.find(query).populate('fromUserId toUserId', 'email').sort({ date: -1 });
    res.json(messages);
  } catch (error) {
    res.status(500).json({ message: 'Ошибка сервера', error: error.message });
  }
});

// Отправить сообщение
router.post('/', async (req, res) => {
  try {
    const { fromUserId, toUserId, text, lotId } = req.body;

    const message = new Message({
      fromUserId,
      toUserId,
      text,
      lotId
    });

    await message.save();

    res.status(201).json(message);
  } catch (error) {
    res.status(500).json({ message: 'Ошибка сервера', error: error.message });
  }
});

module.exports = router;