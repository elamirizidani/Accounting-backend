
const express = require('express');
const router = express.Router();
const Invoice = require('../models/Invoice');
const Quotation = require('../models/Quotation');
const nodemailer = require('nodemailer');


const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});


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
      extraEmail,
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
      extraEmail:extraEmail
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
          { path: 'billedBy' },
          { path: 'items.service'}
        ]
      });
    sendConfirmationEmail(populatedInvoice)
    res.status(201).json(populatedInvoice);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
})



router.get('/', async (req, res) => {
  try {
    // Get invoices sorted by date
    const invoices = await Invoice.find().sort({ createdAt: -1 })
      .populate({
        path: 'quotation',
        populate: [
          { path: 'billedTo' },
          { path: 'billedBy' },
          { path: 'items.service' },
        ]
      });

    // Get current date info
    const now = new Date();
    const currentMonth = now.getMonth() + 1; // JavaScript months are 0-indexed
    const currentYear = now.getFullYear();
    
    // Calculate previous month (handle year change)
    let prevMonth = currentMonth - 1;
    let prevYear = currentYear;
    if (prevMonth === 0) {
      prevMonth = 12;
      prevYear--;
    }

    // Aggregate counts for current month and previous month
    const [currentMonthCounts, previousMonthCounts] = await Promise.all([
      // Current month aggregation
      Invoice.aggregate([
        {
          $match: {
            $expr: {
              $and: [
                { $eq: [{ $month: "$createdAt" }, currentMonth] },
                { $eq: [{ $year: "$createdAt" }, currentYear] }
              ]
            }
          }
        },
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
      ]),
      
      // Previous month aggregation
      Invoice.aggregate([
        {
          $match: {
            $expr: {
              $and: [
                { $eq: [{ $month: "$createdAt" }, prevMonth] },
                { $eq: [{ $year: "$createdAt" }, prevYear] }
              ]
            }
          }
        },
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
      ])
    ]);

    // Convert arrays to objects for easier access
    const currentCounts = {};
    currentMonthCounts.forEach(item => {
      currentCounts[item.status] = item.count;
    });

    const previousCounts = {};
    previousMonthCounts.forEach(item => {
      previousCounts[item.status] = item.count;
    });

    // Calculate percentage changes for each status
    const statusChanges = {};
    const allStatuses = new Set([
      ...Object.keys(currentCounts),
      ...Object.keys(previousCounts)
    ]);

    allStatuses.forEach(status => {
      const current = currentCounts[status] || 0;
      const previous = previousCounts[status] || 0;
      
      if (previous === 0) {
        // Handle division by zero (new status or no previous data)
        statusChanges[status] = current > 0 ? 100 : 0;
      } else {
        const change = ((current - previous) / previous) * 100;
        statusChanges[status] = parseFloat(change.toFixed(2)); // Round to 2 decimal places
      }
    });

    // Get overall status counts (not filtered by month)
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
      statusCounts: counts,
      monthlyStatusChanges: statusChanges,
      currentMonthCounts: currentCounts,
      previousMonthCounts: previousCounts
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




async function sendConfirmationEmail(invoice) {

   const emailHtml = `
    <div style="font-family: Arial, sans-serif; color: #333; max-width: 700px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
      <!-- Header -->
      <div style="text-align: center; margin-bottom: 30px;">
        <img src="${process.env.COMPANY_LOGO}" alt="Company Logo" style="max-width: 150px;">
        <h2 style="color: #2c3e50;">Invoice Confirmation</h2>
      </div>

      <!-- Greeting -->
      <p>Dear ${invoice?.quotation?.billedTo?.name},</p>
      <p>We are pleased to confirm your invoice. Please find the details below:</p>

      <!-- Invoice Details Table -->
      <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd;"><strong>Invoice Number</strong></td>
          <td style="padding: 8px; border: 1px solid #ddd;">${invoice?.invoiceNumber}</td>
        </tr>
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd;"><strong>Invoice Date</strong></td>
          <td style="padding: 8px; border: 1px solid #ddd;">${invoice?.invoiceDate}</td>
        </tr>
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd;"><strong>Due Date</strong></td>
          <td style="padding: 8px; border: 1px solid #ddd;">${invoice?.dueDate}</td>
        </tr>
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd;"><strong>Amount Due</strong></td>
          <td style="padding: 8px; border: 1px solid #ddd;">${invoice?.quotation?.currency} ${invoice?.totalAmount}</td>
        </tr>
      </table>

      <!-- Itemized List -->
      ${invoice?.quotation?.items && invoice?.quotation?.items?.length > 0 ? `
      <h3>Items:</h3>
      <table style="width: 100%; border-collapse: collapse;">
        <tr style="background-color: #f5f5f5;">
          <th style="padding: 8px; border: 1px solid #ddd;">Service</th>
          <th style="padding: 8px; border: 1px solid #ddd;">Quantity</th>
          <th style="padding: 8px; border: 1px solid #ddd;">Unit Price</th>
          <th style="padding: 8px; border: 1px solid #ddd;">Total</th>
        </tr>
        ${invoice?.quotation?.items?.map(item => `
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd;">${item?.service?.service}</td>
          <td style="padding: 8px; border: 1px solid #ddd;">${item?.quantity}</td>
          <td style="padding: 8px; border: 1px solid #ddd;">${invoice?.quotation?.currency} ${item?.unitCost}</td>
          <td style="padding: 8px; border: 1px solid #ddd;">${invoice?.quotation?.currency} ${item?.total}</td>
        </tr>`).join('')}
      </table>` : ''}

      <!-- Payment Info -->
      
      <p style="margin-top: 20px;">BANK DETAILS:</p>
      <table>
        <tr>
          <td className='p-1'><strong>Bank Name:</strong></td>
          <td className='p-1'><strong>Bank of Kigali</strong></td>
        </tr>
        <tr>
          <td className='p-1'><strong>Account Name:</strong></td>
          <td className='p-1'><strong>SYMBOLIX Ltd</strong></td>
        </tr>
        <tr>
          <td className='p-1'><strong>Account No:</strong></td>
          <td className='p-1'><strong>100089237666</strong></td>
        </tr>
        <tr>
          <td className='p-1'><strong>Swift Code</strong></td>
          <td className='p-1'><strong>BKIGRWRW</strong></td>
        </tr>
      </table>
      <p style="padding: 10px; background-color: #f9f9f9; border-left: 4px solid #2c3e50;">${invoice?.note || ''}</p>

      <!-- Footer -->
      <p style="margin-top: 30px;">If you have any questions regarding this invoice, please contact us at 
      <a href="mailto:${invoice?.quotation?.billedBy?.email}">${invoice?.quotation?.billedBy?.email}</a> or call <a href="tel:${invoice?.quotation?.billedBy?.phone}">${invoice?.quotation?.billedBy?.phone}</a>.</p>

      <p style="color: #888; font-size: 12px; margin-top: 20px;">
        This is an automated email. Please do not reply directly to this message.
      </p>
    </div>
  `;

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: invoice?.quotation?.billedTo?.email,
    cc:invoice.extraEmail || '',
    subject: `Invoice #${invoice?.invoiceNumber} Confirmation`,
    html: emailHtml
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Confirmation email sent to ${invoice?.quotation?.billedTo?.name}`);
  } catch (error) {
    console.error('Error sending confirmation email:', error);
  }
}

module.exports = router;