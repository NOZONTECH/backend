const express = require('express');
const { supabase } = require('../server');

const router = express.Router();

// Получить профиль
router.get('/', async (req, res) => {
  try {
    const { userId } = req.query;

    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (userError) throw userError;

    const { data: userLots, error: lotsError } = await supabase
      .from('lots')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (lotsError) throw lotsError;

    const { data: receivedMessages, error: receivedError } = await supabase
      .from('messages')
      .select(`
        *,
        from_user:users!from_user_id(email)
      `)
      .eq('to_user_id', userId)
      .order('created_at', { ascending: false });

    if (receivedError) throw receivedError;

    const { data: sentMessages, error: sentError } = await supabase
      .from('messages')
      .select(`
        *,
        to_user:users!to_user_id(email)
      `)
      .eq('from_user_id', userId)
      .order('created_at', { ascending: false });

    if (sentError) throw sentError;

    const { data: activityLogs, error: activityError } = await supabase
      .from('activity_logs')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (activityError) throw activityError;

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

    const { data, error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', userId)
      .select()
      .single();

    if (error) throw error;

    res.json(data);
  } catch (error) {
    res.status(500).json({ message: 'Ошибка сервера', error: error.message });
  }
});

module.exports = router;
