const express = require('express');
const router = express.Router();
const contactController = require('../controllers/contactController');
const auth = require('../middleware/auth');

router.post('/:itemId', auth, contactController.contactReporter);

module.exports = router;
