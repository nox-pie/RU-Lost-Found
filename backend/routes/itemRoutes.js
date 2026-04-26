const express = require('express');
const router = express.Router();
const itemController = require('../controllers/itemController');
const auth = require('../middleware/auth');
const upload = require('../middleware/upload');

router.get('/', itemController.getItems);
router.post('/', auth, upload.single('image'), itemController.createItem);
router.patch('/:id/status', auth, itemController.updateItemStatus);
router.delete('/:id', auth, itemController.deleteItem);

module.exports = router;
