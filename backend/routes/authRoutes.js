const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const auth = require('../middleware/auth');
const upload = require('../middleware/upload');

router.post('/send-signup-otp', authController.sendSignupOtp);
router.post('/register', upload.single('profilePicture'), authController.register);
router.post('/login', authController.login);
router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password', authController.resetPassword);
router.get('/me', auth, authController.getMe);
router.put('/me', auth, upload.single('profilePicture'), authController.updateProfile);

module.exports = router;
