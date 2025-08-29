const express = require('express');
const router = express.Router();
const Service = require('../models/Service');


// Get all posts
router.get('/', async (req, res) => {
  try {
    const services = await Service.find().sort({ createdAt: -1 });
    res.json(services);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/',async (req,res)=>{
    try {
        const {service,description,code} = req.body
        const serv = new Service({
            service,description,code
        })
        await serv.save();
        res.status(201).json(serv);
        
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
})

module.exports = router;