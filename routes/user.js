const express = require('express');
const router = express.Router();
const User = require('../models/User');
const authMiddleware = require('../middlewares/authMiddleware');
const bcrypt = require('bcryptjs')
// User buys a product


router.get('/profile', authMiddleware, async (req, res) => {
  const userId = req.user.id;

  try {
    const user = await User.findById(userId).select('-password'); // exclude password
    if (!user) return res.status(404).json({ message: 'User not found' });

    res.json({ user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});




router.post('/change-password', authMiddleware, async (req, res) => {
  const userId = req.user.id;
  const { currentPassword, newPassword, confirmPassword } = req.body;

  // Validate input
  if (!currentPassword || !newPassword || !confirmPassword) {
    return res.status(400).json({ 
      success: false,
      message: 'All fields are required' 
    });
  }

  if (newPassword !== confirmPassword) {
    return res.status(400).json({ 
      success: false,
      message: 'New passwords do not match' 
    });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ 
      success: false,
      message: 'Password must be at least 6 characters' 
    });
  }

  try {
    // Find user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ 
        success: false,
        message: 'User not found' 
      });
    }

    // Verify current password (using bcrypt directly)
    const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ 
        success: false,
        message: 'Current password is incorrect' 
      });
    }

    // Hash and update password
    const salt = await bcrypt.genSalt(10);
    const newPasswordHash = await bcrypt.hash(newPassword, salt);
    
    // Update without modifying schema
    await User.findByIdAndUpdate(userId, { 
      passwordHash: newPasswordHash 
    });

    res.json({ 
      success: true,
      message: 'Password changed successfully' 
    });

  } catch (err) {
    console.error('Password change error:', err);
    res.status(500).json({ 
      success: false,
      message: 'Server error while changing password' 
    });
  }
});


module.exports = router;