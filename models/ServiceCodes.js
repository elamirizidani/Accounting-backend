const mongoose = require('mongoose');

const serviceSchema = new mongoose.Schema({
  code:{type:String,default:null},
  subBrand:{type:String,default:null}
});

module.exports = mongoose.model('ServiceCode', serviceSchema);