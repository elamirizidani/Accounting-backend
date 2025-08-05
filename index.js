require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const morgan = require('morgan');
const cors = require('cors');
const connectDB = require('./config/db');

// Load config
// dotenv.config({ path: './config/config.env' });

// Connect to MongoDB
connectDB();

// Initialize app
const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// Routes
app.use('/api/quotations', require('./routes/quotationRoutes'));
app.use('/api/customers', require('./routes/customerRoutes'));
app.use('/api/companies', require('./routes/companyRoutes'));
app.use('/api/services', require('./routes/service'));
app.use('/api/quotation', require('./routes/Quotation'));

// Error handling middleware
app.use(require('./middlewares/errorHandler'));

console.log(process.env.PORT)
const PORT = process.env.PORT || 5001;

app.listen(PORT, () => {
  console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
});


