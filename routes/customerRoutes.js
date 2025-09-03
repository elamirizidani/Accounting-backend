const express = require('express');
const router = express.Router();
const customerController = require('../controllers/customerController');

router.get('/', customerController.getCustomers);
router.post('/', customerController.createCustomer);
router.get('/withDetails', customerController.getCustomersDetails);
router.get('/summary', customerController.getSummary);

module.exports = router;