const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  year: { type: String, required: true },
  school: { type: String, required: true },
  enrollmentNumber: { type: String, required: true },
  phone: { type: String, default: '' },
  profilePicture: { type: String, default: '' },
  resetOtp: { type: String },
  resetOtpExpiry: { type: Date }
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
