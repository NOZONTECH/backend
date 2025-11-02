const express = require('express');
const { supabase } = require('../server');

const router = express.Router();

// Получить лоты
router.get('/', async (req, res) => {
  try {
    const { type, limit } = req.query;
    let query = supabase.from('lots').select(`
      *,
      users!inner(email)
    `).order('created_at', { ascending: false });

    if (type) query = query.eq('type', type);
    if (limit) query = query.limit(parseInt(limit));

    const { data, error } = await query;

    if (error) throw error;

    res.json(data);
  } catch (error) {
    res.status(500).json({ message: 'Ошибка сервера', error: error.message });
  }
});

// Создать лот
router.post('/', async (req, res) => {
  try {
    const { userId, type, title, price, buyNowPrice, description, tags, images, isPremium, location } = req.body;

    const { data, error } = await supabase
      .from('lots')
      .insert({
        user_id: userId,
        type,
        title,
        price,
        buy_now_price: buyNowPrice,
        description,
        tags,
        images,
        is_premium: isPremium,
        location
      })
      .select()
      .single();

    if (error) throw error;

    // Логируем действие
    await supabase.from('activity_logs').insert({
      user_id: userId,
      action: 'created',
      target_id: data.id
    });

    res.status(201).json(data);
  } catch (error) {
    res.status(500).json({ message: 'Ошибка сервера', error: error.message });
  }
});

// Обновить лот
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const { data, error } = await supabase
      .from('lots')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    // Логируем действие
    await supabase.from('activity_logs').insert({
      user_id: data.user_id,
      action: 'edited',
      target_id: data.id
    });

    res.json(data);
  } catch (error) {
    res.status(500).json({ message: 'Ошибка сервера', error: error.message });
  }
});

// Удалить лот
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from('lots')
      .delete()
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    // Логируем действие
    await supabase.from('activity_logs').insert({
      user_id: data.user_id,
      action: 'deleted',
      target_id: data.id
    });

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

    // Получаем текущий лот
    const { data: lot, error: lotError } = await supabase
      .from('lots')
      .select('*')
      .eq('id', id)
      .single();

    if (lotError) throw lotError;

    // Добавляем ставку
    const newBid = {
      user_id: userId,
      amount,
      date: new Date().toISOString()
    };

    const updatedBids = [...(lot.bids || []), newBid];

    const { data, error } = await supabase
      .from('lots')
      .update({ bids: updatedBids })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    res.json(data);
  } catch (error) {
    res.status(500).json({ message: 'Ошибка сервера', error: error.message });
  }
});

module.exports = router;
