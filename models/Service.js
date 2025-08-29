const mongoose = require('mongoose');

const serviceSchema = new mongoose.Schema({
  service: { type: String, required: true },
  description: { type: String },
  code:{type:String,default:null}
});

module.exports = mongoose.model('Service', serviceSchema);