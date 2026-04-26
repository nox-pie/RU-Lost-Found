const mongoose = require('mongoose');

const itemSchema = new mongoose.Schema({
  type: { type: String, enum: ['lost', 'found'], required: true },
  title: { type: String, required: true },
  description: { type: String, required: true },
  location: { type: String, required: true },
  date: { type: String, required: true },
  reporter: { type: String, required: true },
  reporterId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  status: { type: String, enum: ['open', 'claimed'], default: 'open' },
  image: { type: String },
  claimedBy: {
    name: String,
    contact: String,
    details: String
  }
}, { timestamps: true });

module.exports = mongoose.model('Item', itemSchema);
