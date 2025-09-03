const mongoose = require('mongoose');

const serviceSchema = new mongoose.Schema({
  service: { type: String, required: true },
  description: { type: String }
});

module.exports = mongoose.model('Service', serviceSchema);