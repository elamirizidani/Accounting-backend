const Quotation = require('../models/Quotation');
const Customer = require('../models/Customer');
const Company = require('../models/Company');


// const generateQuotationId = async () => {
//   const count = await Quotation.countDocuments();
//   return `Q${10000 + count + 1}`;
// }

const generateQuotationId = (prefix = 'Q-', length = 5) => {
  const randomNumber = Math.floor(Math.random() * Math.pow(10, length));
  return prefix + String(randomNumber).padStart(length, '0');
};

const calculateItemTotal = (item, enableTax) => {
  const subtotal = item.quantity * item.unitCost;
  if (enableTax) {
    return subtotal + (subtotal * (item.vat / 100));
  }
  return subtotal;
};


// @desc    Get all quotations
// @route   GET /api/quotations
// @access  Public
exports.getQuotations = async (req, res) => {
  try {
    const quotations = await Quotation.find()
      .populate('billedBy', 'name address phone email')
      .populate('billedTo', 'name address phone email');
    res.json(quotations);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// @desc    Get single quotation
// @route   GET /api/quotations/:id
// @access  Public
exports.getQuotation = async (req, res) => {
  try {
    const quotation = await Quotation.findById(req.params.id)
      .populate('billedBy', 'name address phone email')
      .populate('billedTo', 'name address phone email');
    
    if (!quotation) {
      return res.status(404).json({ message: 'Quotation not found' });
    }
    
    res.json(quotation);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};



exports.createQuotation = async (req, res) => {
  try {
    
    const company = await Company.findById(req.body.billedBy);
    if (!company) {
      return res.status(400).json({ message: 'Company not found' });
    }
    
    // console.log(req.body)

    const customer = await Customer.findById(req.body.billedTo);
    if (!customer) {
      return res.status(400).json({ message: 'Customer not found' });
    }

    const quotationId = await generateQuotationId();
    const quotation = new Quotation({
      quotationId,
      ...req.body
    });

    const savedQuotation = await quotation.save();
    res.status(201).json(savedQuotation);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// @desc    Update quotation
// @route   PUT /api/quotations/:id
// @access  Public
exports.updateQuotation = async (req, res) => {
  try {
    // If items are being updated, calculate their totals
    if (req.body.items) {
      const quotation = await Quotation.findById(req.params.id);
      const enableTax = req.body.enableTax !== undefined ? req.body.enableTax : quotation.enableTax;
      
      req.body.items = req.body.items.map(item => ({
        ...item,
        total: calculateItemTotal(item, enableTax)
      }));
    }

    const updatedQuotation = await Quotation.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    
    if (!updatedQuotation) {
      return res.status(404).json({ message: 'Quotation not found' });
    }
    
    res.json(updatedQuotation);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// @desc    Delete quotation
// @route   DELETE /api/quotations/:id
// @access  Public
exports.deleteQuotation = async (req, res) => {
  try {
    const quotation = await Quotation.findByIdAndDelete(req.params.id);
    
    if (!quotation) {
      return res.status(404).json({ message: 'Quotation not found' });
    }
    
    res.json({ message: 'Quotation deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};