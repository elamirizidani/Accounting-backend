
const express = require('express');
const router = express.Router();
const Invoice = require('../models/Invoice');
const Quotation = require('../models/Quotation');



router.post('/',async (req,res)=>{
    try {
        const { 
          quotation,
          invoiceDate,
      dueDate,
      status = 'approved',
      paymentTerms,
      totalAmount,
      paymentMethod='',
      notes,
      invoiceStatus = 'unpaid'
         } = req.body;
let quotationData;


if (quotation) {
      // Case 1: Using existing quotation
      quotationData = await Quotation.findById(quotation)
        .populate('billedTo')
        .populate('billedBy');
      if (!quotationData) {
        return res.status(404).json({ message: 'Quotation not found' });
      }
      
      if (quotationData.status !== 'approved') {
        return res.status(400).json({ 
          message: 'Only approved quotations can be converted to invoices' 
        });
      }
    }
    else {
      try {
        req.body.quotationId = await generateQuotationId();
        const newQuotation = new Quotation(req.body);
        quotationData = await newQuotation.save();
        
        // Populate the references
        quotationData = await Quotation.findById(quotationData._id)
          .populate('billedTo')
          .populate('billedBy');

      } catch (quotationError) {
        return res.status(400).json({ 
          message: 'Failed to create quotation',
          error: quotationError.message 
        });
      }
    }


    const invoiceCount = await Invoice.countDocuments();
    const invoiceNumber = `INV-${(invoiceCount + 1).toString().padStart(4, '0')}`;


    const invoice = new Invoice({
      invoiceNumber,
      quotation: quotationData._id,
      invoiceDate: invoiceDate || new Date(), // Default to current date if not provided
      dueDate: dueDate || calculateDueDate(invoiceDate), // Add your due date calculation logic
      status:invoiceStatus,
      paymentTerms: paymentTerms || 'Due on receipt', // Default payment terms
      totalAmount: totalAmount || quotationData.totalAmount, // Use quotation total if not provided
      paymentMethod,
      notes,
    });
    
    await invoice.save();
    quotationData.convertedToInvoice = true;
    quotationData.invoice = invoice._id;
    await quotationData.save();
    
    // Return populated invoice
    const populatedInvoice = await Invoice.findById(invoice._id)
      .populate({
        path: 'quotation',
        populate: [
          { path: 'billedTo' },
          { path: 'billedBy' }
        ]
      });
    
    res.status(201).json(populatedInvoice);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
})


router.get('/', async (req, res) => {
  try {
    const invoices = await Invoice.find().sort({ createdAt: -1 })
      .populate({
        path: 'quotation',
        populate: [
          { path: 'billedTo' },
          { path: 'billedBy' },
          { path: 'items.service' },
        ]
      });
    const statusCounts = await Invoice.aggregate([
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 }
        }
      },
      {
        $project: {
          status: "$_id",
          count: 1,
          _id: 0
        }
      }
    ]);

    const counts = {};
    statusCounts.forEach(item => {
      counts[item.status] = item.count;
    });

    res.status(200).json({
      invoices,
      statusCounts: counts
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

function calculateDueDate(invoiceDate) {
  const date = invoiceDate ? new Date(invoiceDate) : new Date();
  date.setDate(date.getDate() + 30); // 30 days by default
  return date;
}
const generateQuotationId = async (prefix = 'P-', length = 2) => {
  const count = await Quotation.countDocuments();
  const currentYear = new Date().getFullYear();
  const lastTwoDigits = currentYear.toString().slice(-2);
  const sequenceNumber = count === 0 ? 14 : count + 1;
  return prefix + sequenceNumber + `/${lastTwoDigits}`;
};

module.exports = router;