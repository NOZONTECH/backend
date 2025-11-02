const express = require('express');
const { supabase } = require('../server');

const router = express.Router();

// Получить сообщения
router.get('/', async (req, res) => {
  try {
    const { toUserId, fromUserId } = req.query;
    let query = supabase.from('messages').select(`
      *,
      from_user:users!from_user_id(email),
      to_user:users!to_user_id(email)
    `).order('created_at', { ascending: false });

    if (toUserId) query = query.eq('to_user_id', toUserId);
    if (fromUserId) query = query.eq('from_user_id', fromUserId);

    const { data, error } = await query;

    if (error) throw error;

    res.json(data);
  } catch (error) {
    res.status(500).json({ message: 'Ошибка сервера', error: error.message });
  }
});

// Отправить сообщение
router.post('/', async (req, res) => {
  try {
    const { fromUserId, toUserId, text, lotId } = req.body;

    const { data, error } = await supabase
      .from('messages')
      .insert({
        from_user_id: fromUserId,
        to_user_id: toUserId,
        text,
        lot_id: lotId
      })
      .select()
      .single();

    if (error) throw error;

    res.status(201).json(data);
  } catch (error) {
    res.status(500).json({ message: 'Ошибка сервера', error: error.message });
  }
});

module.exports = router;
