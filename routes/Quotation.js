const express = require('express');
const router = express.Router();
const Quotation = require('../models/Quotation');
const mongoose = require('mongoose');

// Create a new quotation

const generateQuotationId = (prefix = 'Q-', length = 5) => {
  const randomNumber = Math.floor(Math.random() * Math.pow(10, length));
  return prefix + String(randomNumber).padStart(length, '0');
};

router.post('/', async (req, res) => {
  try {
    // Generate a unique quotation ID (you might want to customize this)
    const count = await Quotation.countDocuments();
    req.body.quotationId = generateQuotationId();
    const quotation = new Quotation(req.body);
    await quotation.save();
    res.status(201).send(quotation);

  } catch (error) {
    res.status(400).send({ error: error.message });
  }
});

// Get all quotations
router.get('/', async (req, res) => {
  try {
    const { status, billedTo, billedBy } = req.query;
    const filter = {};
    
    if (status) filter.status = status;
    if (billedTo) filter.billedTo = billedTo;
    if (billedBy) filter.billedBy = billedBy;
    
    const quotations = await Quotation.find(filter)
      .populate('billedBy')
      .populate('billedTo')
      .populate('items.service');
      
    res.send(quotations);
  } catch (error) {
    res.status(500).send({ error: error.message });
  }
});

// Get a single quotation by ID
router.get('/:id', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).send({ error: 'Invalid quotation ID' });
    }
    
    const quotation = await Quotation.findById(req.params.id)
      .populate('billedBy')
      .populate('billedTo')
      .populate('items.service');
      
    if (!quotation) {
      return res.status(404).send({ error: 'Quotation not found' });
    }
    
    res.send(quotation);
  } catch (error) {
    res.status(500).send({ error: error.message });
  }
});

// Update a quotation
router.patch('/:id', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).send({ error: 'Invalid quotation ID' });
    }
    
    const quotation = await Quotation.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    ).populate('billedBy').populate('billedTo').populate('items.service');
    
    if (!quotation) {
      return res.status(404).send({ error: 'Quotation not found' });
    }
    
    res.send(quotation);
  } catch (error) {
    res.status(400).send({ error: error.message });
  }
});

// Delete a quotation
router.delete('/:id', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).send({ error: 'Invalid quotation ID' });
    }
    
    const quotation = await Quotation.findByIdAndDelete(req.params.id);
    
    if (!quotation) {
      return res.status(404).send({ error: 'Quotation not found' });
    }
    
    res.send({ message: 'Quotation deleted successfully' });
  } catch (error) {
    res.status(500).send({ error: error.message });
  }
});

// Update quotation status
router.patch('/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    if (!['draft', 'pending', 'approved', 'rejected'].includes(status)) {
      return res.status(400).send({ error: 'Invalid status' });
    }
    
    const quotation = await Quotation.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    ).populate('billedBy').populate('billedTo');
    
    if (!quotation) {
      return res.status(404).send({ error: 'Quotation not found' });
    }
    
    res.send(quotation);
  } catch (error) {
    res.status(400).send({ error: error.message });
  }
});

// Calculate totals for a quotation
router.get('/:id/totals', async (req, res) => {
  try {
    const quotation = await Quotation.findById(req.params.id);
    if (!quotation) {
      return res.status(404).send({ error: 'Quotation not found' });
    }
    
    const subtotal = quotation.items.reduce((sum, item) => sum + (item.quantity * item.unitCost), 0);
    const taxTotal = quotation.items.reduce((sum, item) => {
      return sum + (item.quantity * item.unitCost * (item.vat / 100));
    }, 0);
    
    const discountAmount = subtotal * (quotation.discount / 100);
    const total = subtotal + taxTotal - discountAmount;
    
    res.send({
      subtotal,
      taxTotal,
      discount: quotation.discount,
      discountAmount,
      total: quotation.roundOffTotal ? Math.round(total) : total
    });
  } catch (error) {
    res.status(500).send({ error: error.message });
  }
});

module.exports = router;