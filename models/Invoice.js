// models/Invoice.js
const mongoose = require('mongoose');

const invoiceSchema = new mongoose.Schema({
  invoiceNumber: { type: String, required: true, unique: true },
  quotation: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Quotation',
    required: true 
  },
  invoiceDate: { type: Date, default: Date.now },
  dueDate: { type: Date, required: true },
  status: { 
    type: String, 
    enum: ['draft', 'unpaid', 'paid', 'overdue', 'cancelled'],
    default: 'draft'
  },
  paymentTerms: String,
  paymentMethod: String,
  totalAmount:String,
  notes: String,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Invoice', invoiceSchema);