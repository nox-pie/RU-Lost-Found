const Item = require('../models/Item');

exports.getItems = async (req, res) => {
  try {
    const items = await Item.find().sort({ createdAt: -1 }).populate('reporterId', 'firstName lastName email');
    res.json(items);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.createItem = async (req, res) => {
  try {
    const { type, title, description, location, date, reporter } = req.body;
    
    if (!req.file) {
      return res.status(400).json({ message: 'Image is required' });
    }

    // With CloudinaryStorage, req.file.path contains the public Cloudinary URL
    const imageUrl = req.file.path;
    
    const newItem = new Item({
      type, title, description, location, date, image: imageUrl, reporter,
      reporterId: req.user.id
    });

    const item = await newItem.save();
    res.status(201).json(item);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.updateItemStatus = async (req, res) => {
  try {
    const { status, claimedBy } = req.body;
    let item = await Item.findById(req.params.id);
    
    if (!item) return res.status(404).json({ message: 'Item not found' });
    
    item.status = status;
    if (claimedBy) {
      item.claimedBy = claimedBy;
    }
    
    await item.save();
    res.json(item);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.deleteItem = async (req, res) => {
  try {
    const item = await Item.findById(req.params.id);
    
    if (!item) return res.status(404).json({ message: 'Item not found' });
    
    if (item.reporterId.toString() !== req.user.id) {
      return res.status(401).json({ message: 'User not authorized' });
    }

    await item.deleteOne();
    res.json({ message: 'Item removed' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};
