const Customer = require('../models/Customer');
const Invoice = require('../models/Invoice');
const Quotation = require('../models/Quotation');


const generateCompanyCode = async (prefix = 'C') => {
  const count = await Customer.countDocuments();
  const sequenceNumber = count + 1;
  return prefix + `${sequenceNumber.toString().padStart(4, '0')}`;
};

// @desc    Get all customers
// @route   GET /api/customers
// @access  Public
exports.getCustomers = async (req, res) => {
  try {
    const customers = await Customer.find();
    res.json(customers);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};


exports.getCustomersDetails = async (req,res)=>{
  try {
    // Get all customers
    const customers = await Customer.find().lean();
    
    // For each customer, find their related invoices
    const customersWithInvoices = await Promise.all(
      customers.map(async (customer) => {
        // Find quotations for this customer
        const quotations = await Quotation.find({ billedTo: customer._id }).lean();
        
        // Extract quotation IDs
        const quotationIds = quotations.map(q => q._id);
        
        // Find invoices related to these quotations
        const invoices = await Invoice.find({ 
          quotation: { $in: quotationIds } 
        }).populate('quotation').lean();
        
        // Calculate total income and count
        const totalInvoices = invoices.length;
        const totalIncome = invoices.reduce((sum, invoice) => {
          // Parse totalAmount to number (remove currency symbols, commas, etc.)
          const amount = parseFloat(invoice.totalAmount?.toString().replace(/[^0-9.-]/g, '') || 0);
          return sum + amount;
        }, 0);
        
        // Calculate paid income only from paid invoices
        const paidIncome = invoices
          .filter(invoice => invoice.status === 'paid')
          .reduce((sum, invoice) => {
            const amount = parseFloat(invoice.totalAmount?.toString().replace(/[^0-9.-]/g, '') || 0);
            return sum + amount;
          }, 0);
        
        // Count invoices by status
        const invoicesByStatus = invoices.reduce((acc, invoice) => {
          acc[invoice.status] = (acc[invoice.status] || 0) + 1;
          return acc;
        }, {});
        
        return {
          ...customer,
          invoices: invoices || [],
          summary: {
            totalInvoices,
            totalIncome: Number(totalIncome.toFixed(2)),
            paidIncome: Number(paidIncome.toFixed(2)),
            pendingIncome: Number((totalIncome - paidIncome).toFixed(2)),
            invoicesByStatus
          }
        };
      })
    );
    
    res.status(200).json({
      success: true,
      data: customersWithInvoices,
      count: customersWithInvoices.length
    });
    
  } catch (error) {
    console.error('Error fetching customers with invoices:', error);
    res.status(500).json({
      success: false,
      error: 'Server Error',
      message: error.message
    });
  }
}



// @desc    Create customer
// @route   POST /api/customers
// @access  Public
exports.createCustomer = async (req, res) => {
  try {
    req.body.customerCode = await generateCompanyCode();
    console.log(req.body)
    const customer = new Customer(req.body);
    const savedCustomer = await customer.save();
    res.status(201).json(savedCustomer);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};



exports.specificCustomer =async (req, res) => {
  try {
    const customerId = req.params.id;
    
    // Find the customer
    const customer = await Customer.findById(customerId).lean();
    
    if (!customer) {
      return res.status(404).json({
        success: false,
        error: 'Customer not found'
      });
    }
    
    // Find quotations for this customer
    const quotations = await Quotation.find({ billedTo: customerId }).lean();
    
    // Extract quotation IDs
    const quotationIds = quotations.map(q => q._id);
    
    // Find invoices related to these quotations
    const invoices = await Invoice.find({ 
      quotation: { $in: quotationIds } 
    }).populate({
      path: 'quotation',
      populate: {
        path: 'items.service',
        model: 'Service'
      }
    }).lean();
    
    // Calculate summary statistics
    const totalInvoices = invoices.length;
    const totalIncome = invoices.reduce((sum, invoice) => {
      const amount = parseFloat(invoice.totalAmount?.toString().replace(/[^0-9.-]/g, '') || 0);
      return sum + amount;
    }, 0);
    
    const paidIncome = invoices
      .filter(invoice => invoice.status === 'paid')
      .reduce((sum, invoice) => {
        const amount = parseFloat(invoice.totalAmount?.toString().replace(/[^0-9.-]/g, '') || 0);
        return sum + amount;
      }, 0);
    
    // Count invoices by status
    const invoicesByStatus = invoices.reduce((acc, invoice) => {
      acc[invoice.status] = (acc[invoice.status] || 0) + 1;
      return acc;
    }, {});
    
    // Calculate monthly income for the last 12 months
    const monthlyIncome = {};
    const currentDate = new Date();
    for (let i = 0; i < 12; i++) {
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
      const monthKey = date.toISOString().substring(0, 7); // YYYY-MM format
      monthlyIncome[monthKey] = 0;
    }
    
    invoices.forEach(invoice => {
      if (invoice.invoiceDate && invoice.status === 'paid') {
        const monthKey = new Date(invoice.invoiceDate).toISOString().substring(0, 7);
        if (monthlyIncome.hasOwnProperty(monthKey)) {
          const amount = parseFloat(invoice.totalAmount?.toString().replace(/[^0-9.-]/g, '') || 0);
          monthlyIncome[monthKey] += amount;
        }
      }
    });
    
    res.status(200).json({
      success: true,
      data: {
        ...customer,
        invoices: invoices || [],
        summary: {
          totalInvoices,
          totalIncome: Number(totalIncome.toFixed(2)),
          paidIncome: Number(paidIncome.toFixed(2)),
          pendingIncome: Number((totalIncome - paidIncome).toFixed(2)),
          invoicesByStatus,
          monthlyIncome: Object.fromEntries(
            Object.entries(monthlyIncome).map(([key, value]) => [key, Number(value.toFixed(2))])
          )
        }
      }
    });
    
  } catch (error) {
    console.error('Error fetching customer with invoices:', error);
    res.status(500).json({
      success: false,
      error: 'Server Error',
      message: error.message
    });
  }
};

// GET /api/customers/:id/invoices - Get only invoices for a specific customer
exports.invoices = async (req, res) => {
  try {
    const customerId = req.params.id;
    const { status, startDate, endDate } = req.query;
    
    // Verify customer exists
    const customer = await Customer.findById(customerId);
    if (!customer) {
      return res.status(404).json({
        success: false,
        error: 'Customer not found'
      });
    }
    
    // Find quotations for this customer
    const quotations = await Quotation.find({ billedTo: customerId }).lean();
    const quotationIds = quotations.map(q => q._id);
    
    // Build query for invoices
    let invoiceQuery = { quotation: { $in: quotationIds } };
    
    // Add status filter if provided
    if (status) {
      invoiceQuery.status = status;
    }
    
    // Add date range filter if provided
    if (startDate || endDate) {
      invoiceQuery.invoiceDate = {};
      if (startDate) {
        invoiceQuery.invoiceDate.$gte = new Date(startDate);
      }
      if (endDate) {
        invoiceQuery.invoiceDate.$lte = new Date(endDate);
      }
    }
    
    // Find invoices with populated quotation details
    const invoices = await Invoice.find(invoiceQuery)
      .populate({
        path: 'quotation',
        populate: {
          path: 'items.service',
          model: 'Service'
        }
      })
      .sort({ invoiceDate: -1 })
      .lean();
    
    // Calculate summary for filtered results
    const totalInvoices = invoices.length;
    const totalIncome = invoices.reduce((sum, invoice) => {
      const amount = parseFloat(invoice.totalAmount?.toString().replace(/[^0-9.-]/g, '') || 0);
      return sum + amount;
    }, 0);
    
    const paidIncome = invoices
      .filter(invoice => invoice.status === 'paid')
      .reduce((sum, invoice) => {
        const amount = parseFloat(invoice.totalAmount?.toString().replace(/[^0-9.-]/g, '') || 0);
        return sum + amount;
      }, 0);
    
    const invoicesByStatus = invoices.reduce((acc, invoice) => {
      acc[invoice.status] = (acc[invoice.status] || 0) + 1;
      return acc;
    }, {});
    
    res.status(200).json({
      success: true,
      data: invoices,
      count: invoices.length,
      customer: {
        _id: customer._id,
        name: customer.name,
        customerCode: customer.customerCode,
        phone: customer.phone,
        email: customer.email
      },
      summary: {
        totalInvoices,
        totalIncome: Number(totalIncome.toFixed(2)),
        paidIncome: Number(paidIncome.toFixed(2)),
        pendingIncome: Number((totalIncome - paidIncome).toFixed(2)),
        invoicesByStatus
      }
    });
    
  } catch (error) {
    console.error('Error fetching customer invoices:', error);
    res.status(500).json({
      success: false,
      error: 'Server Error',
      message: error.message
    });
  }
};


exports.getSummary = async (req, res) => {
  try {
    // Get all customers
    const customers = await Customer.find().lean();
    
    // For each customer, calculate summary statistics
    const customersSummary = await Promise.all(
      customers.map(async (customer) => {
        // Find quotations for this customer
        const quotations = await Quotation.find({ billedTo: customer._id }).lean();
        
        // Extract quotation IDs
        const quotationIds = quotations.map(q => q._id);
        
        // Find invoices related to these quotations
        const invoices = await Invoice.find({ 
          quotation: { $in: quotationIds } 
        }).lean();
        
        // Calculate summary statistics
        const totalInvoices = invoices.length;
        const totalIncome = invoices.reduce((sum, invoice) => {
          const amount = parseFloat(invoice.totalAmount?.toString().replace(/[^0-9.-]/g, '') || 0);
          return sum + amount;
        }, 0);
        
        const paidIncome = invoices
          .filter(invoice => invoice.status === 'paid')
          .reduce((sum, invoice) => {
            const amount = parseFloat(invoice.totalAmount?.toString().replace(/[^0-9.-]/g, '') || 0);
            return sum + amount;
          }, 0);
        
        // Count invoices by status
        const invoicesByStatus = invoices.reduce((acc, invoice) => {
          acc[invoice.status] = (acc[invoice.status] || 0) + 1;
          return acc;
        }, {});
        
        // Find most recent invoice date
        const lastInvoiceDate = invoices.length > 0 
          ? new Date(Math.max(...invoices.map(inv => new Date(inv.invoiceDate))))
          : null;
        
        return {
          ...customer,
          summary: {
            totalInvoices,
            totalIncome: Number(totalIncome.toFixed(2)),
            paidIncome: Number(paidIncome.toFixed(2)),
            pendingIncome: Number((totalIncome - paidIncome).toFixed(2)),
            invoicesByStatus,
            lastInvoiceDate
          }
        };
      })
    );
    
    // Sort by total income (highest first)
    customersSummary.sort((a, b) => b.summary.totalIncome - a.summary.totalIncome);
    
    res.status(200).json({
      success: true,
      data: customersSummary,
      count: customersSummary.length
    });
    
  } catch (error) {
    console.error('Error fetching customer summaries:', error);
    res.status(500).json({
      success: false,
      error: 'Server Error',
      message: error.message
    });
  }
};
