
const express = require('express');
const router = express.Router();
const Invoice = require('../models/Invoice');
const Quotation = require('../models/Quotation');


router.post('/',async (req,res)=>{
    try {
        const { quotationId } = req.params;
    
    // Get the quotation
    const quotation = await Quotation.findById(quotationId)
      .populate('billedTo')
      .populate('billedBy');
    
    if (!quotation) {
      return res.status(404).json({ message: 'Quotation not found' });
    }
    
    // Validate quotation status
    if (quotation.status !== 'approved') {
      return res.status(400).json({ 
        message: 'Only approved quotations can be converted to invoices' 
      });
    }
    
    // Generate invoice number
    const invoiceCount = await Invoice.countDocuments();
    const invoiceNumber = `INV-${(invoiceCount + 1).toString().padStart(4, '0')}`;
    
    // Calculate due date (30 days from now by default)
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 30);
    
    // Create invoice
    const invoice = new Invoice({
      invoiceNumber,
      quotation: quotation._id,
      invoiceDate: new Date(),
      dueDate,
      status: 'sent',
      paymentTerms: 'Net 30'
    });
    
    await invoice.save();
    
    // Update quotation to mark as converted
    quotation.convertedToInvoice = true;
    quotation.invoice = invoice._id;
    await quotation.save();
    
    // Populate the response with quotation data
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


// exports.createInvoice = async (req, res) => {
//   try {
//     const { quotationId } = req.params;
    
//     // Get the quotation
//     const quotation = await Quotation.findById(quotationId)
//       .populate('billedTo')
//       .populate('billedBy');
    
//     if (!quotation) {
//       return res.status(404).json({ message: 'Quotation not found' });
//     }
    
//     // Validate quotation status
//     if (quotation.status !== 'approved') {
//       return res.status(400).json({ 
//         message: 'Only approved quotations can be converted to invoices' 
//       });
//     }
    
//     // Generate invoice number
//     const invoiceCount = await Invoice.countDocuments();
//     const invoiceNumber = `INV-${(invoiceCount + 1).toString().padStart(4, '0')}`;
    
//     // Calculate due date (30 days from now by default)
//     const dueDate = new Date();
//     dueDate.setDate(dueDate.getDate() + 30);
    
//     // Create invoice
//     const invoice = new Invoice({
//       invoiceNumber,
//       quotation: quotation._id,
//       invoiceDate: new Date(),
//       dueDate,
//       status: 'sent',
//       paymentTerms: 'Net 30'
//     });
    
//     await invoice.save();
    
//     // Update quotation to mark as converted
//     quotation.convertedToInvoice = true;
//     quotation.invoice = invoice._id;
//     await quotation.save();
    
//     // Populate the response with quotation data
//     const populatedInvoice = await Invoice.findById(invoice._id)
//       .populate({
//         path: 'quotation',
//         populate: [
//           { path: 'billedTo' },
//           { path: 'billedBy' }
//         ]
//       });
    
//     res.status(201).json(populatedInvoice);
//   } catch (error) {
//     res.status(500).json({ message: error.message });
//   }
// };

module.exports = router;