const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const crypto = require('crypto');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// Temporary in-memory store for signup OTPs
// Format: { email: { otp: string, expiresAt: number } }
const signupOtpStore = new Map();

// Cleanup expired OTPs every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [email, data] of signupOtpStore) {
    if (now > data.expiresAt) signupOtpStore.delete(email);
  }
}, 5 * 60 * 1000);

exports.sendSignupOtp = async (req, res) => {
  try {
    const { email } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ message: 'User already exists with this email' });

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    signupOtpStore.set(email, { otp, expiresAt: Date.now() + 10 * 60 * 1000 });

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: '[RU Lost & Found] Email Verification OTP',
      html: `
        <h3>Welcome to RU Lost & Found!</h3>
        <p>Please verify your email address by entering this 6-digit code during signup:</p>
        <h2 style="color: #f97316;">${otp}</h2>
        <p>This code will expire in 10 minutes.</p>
        <br/>
        <p>Best regards,<br/>RU Lost & Found Team</p>
      `
    };

    await transporter.sendMail(mailOptions);
    res.json({ message: 'Verification OTP sent to email' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.register = async (req, res) => {
  try {
    const { email, password, firstName, lastName, year, school, enrollmentNumber, phone, signupOtp } = req.body;
    
    // Verify the signup OTP
    const storedData = signupOtpStore.get(email);
    if (!storedData) {
      return res.status(400).json({ message: 'Please verify your email first by requesting an OTP' });
    }
    if (storedData.otp !== signupOtp) {
      return res.status(400).json({ message: 'Invalid verification code' });
    }
    if (Date.now() > storedData.expiresAt) {
      signupOtpStore.delete(email);
      return res.status(400).json({ message: 'Verification code has expired. Please request a new one.' });
    }

    // OTP valid — clean up and proceed
    signupOtpStore.delete(email);

    let user = await User.findOne({ email });
    if (user) return res.status(400).json({ message: 'User already exists' });

    let profilePicture = '';
    if (req.file) {
      // Cloudinary URL is in req.file.path
      profilePicture = req.file.path;
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    user = new User({
      email, password: hashedPassword, firstName, lastName, year, school, enrollmentNumber, phone, profilePicture
    });

    await user.save();

    const payload = { user: { id: user.id } };
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '5h' });

    res.status(201).json({ token, user: { id: user.id, email, firstName, lastName, year, school, enrollmentNumber, phone, profilePicture } });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: 'Invalid credentials' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: 'Invalid credentials' });

    const payload = { user: { id: user.id } };
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '5h' });

    res.json({ token, user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, year: user.year, school: user.school, enrollmentNumber: user.enrollmentNumber, phone: user.phone, profilePicture: user.profilePicture } });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: 'User not found' });

    // Generate 6 digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Set expiry to 10 minutes from now
    user.resetOtp = otp;
    user.resetOtpExpiry = Date.now() + 10 * 60 * 1000;
    await user.save();

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: user.email,
      subject: '[RU Lost & Found] Password Reset OTP',
      html: `
        <h3>Hello ${user.firstName},</h3>
        <p>You requested to reset your password. Here is your 6-digit OTP code:</p>
        <h2 style="color: #f97316;">${otp}</h2>
        <p>This code will expire in 10 minutes. If you did not request a password reset, please ignore this email.</p>
        <br/>
        <p>Best regards,<br/>RU Lost & Found Team</p>
      `
    };

    await transporter.sendMail(mailOptions);
    res.json({ message: 'OTP sent to email' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;
    
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (user.resetOtp !== otp) {
      return res.status(400).json({ message: 'Invalid OTP' });
    }

    if (Date.now() > user.resetOtpExpiry) {
      return res.status(400).json({ message: 'OTP has expired' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    user.password = hashedPassword;
    user.resetOtp = undefined;
    user.resetOtpExpiry = undefined;
    await user.save();

    res.json({ message: 'Password reset successful' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const { firstName, lastName, year, school, enrollmentNumber, phone } = req.body;

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    // Update text fields if provided
    if (firstName) user.firstName = firstName;
    if (lastName) user.lastName = lastName;
    if (year) user.year = year;
    if (school) user.school = school;
    if (enrollmentNumber) user.enrollmentNumber = enrollmentNumber;
    if (phone !== undefined) user.phone = phone;

    // Update profile picture if a new file was uploaded (Cloudinary URL)
    if (req.file) {
      user.profilePicture = req.file.path;
    }

    await user.save();

    const updatedUser = user.toObject();
    delete updatedUser.password;
    res.json(updatedUser);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};
