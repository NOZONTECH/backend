const mongoose = require('mongoose');

const lotSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    enum: ['service', 'sale', 'lot'],
    required: true
  },
  title: {
    type: String,
    required: true
  },
  price: {
    type: Number,
    required: true
  },
  buyNowPrice: {
    type: Number,
    default: null
  },
  description: {
    type: String,
    required: true
  },
  tags: [String],
  images: [String],
  views: {
    type: Number,
    default: 0
  },
  clicks: {
    type: Number,
    default: 0
  },
  bids: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    amount: Number,
    date: {
      type: Date,
      default: Date.now
    }
  }],
  isPremium: {
    type: Boolean,
    default: false
  },
  location: String,
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Lot', lotSchema);
