const mongoose = require('mongoose');

const itemSchema = new mongoose.Schema({
  service: { 
    type:  mongoose.Schema.Types.ObjectId, 
    ref:'Service',
    required: true
   },
  description: { type: String },
  quantity: { type: Number, required: true, default: 1 },
  unitCost: { type: Number, required: true },
  vat: { type: Number, default: 0 },
  total: { type: Number, required: true },
  code:{ 
      type:  mongoose.Schema.Types.ObjectId, 
      ref:'ServiceCode',
      required: true
     },
});

const quotationSchema = new mongoose.Schema({
  quotationId: { type: String, required: true, unique: true },
  referenceNumber: { type: String },
  status: { 
    type: String, 
    enum: ['draft', 'pending', 'approved', 'rejected'], 
    default: 'draft' 
  },
  currency: { 
    type: String, 
    enum: ['USD', 'EUR', 'RWF'], 
    default: 'USD' 
  },
  quotationDate: { type: Date, default: Date.now },
  dueDate: { type: Date },
  enableTax: { type: Boolean, default: true },
  billedBy: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Company', 
    required: true 
  },
  billedTo: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Customer', 
    required: true 
  },
  items: [itemSchema],
  additionalNotes: { type: String },
  termsConditions: { type: String },
  bankDetails: { type: String },
  discount: { type: Number, default: 0 },
  roundOffTotal: { type: Boolean, default: true },
  signatureName: { type: String },
  signatureImage: { type: String },
  totalAmount:{type: String},
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

// Calculate totals before saving
quotationSchema.pre('save', function(next) {
  this.items.forEach(item => {
    item.total = item.quantity * item.unitCost;
    if (this.enableTax) {
      item.total += item.total * (item.vat / 100);
    }
  });
  next();
});

module.exports = mongoose.model('Quotation', quotationSchema);