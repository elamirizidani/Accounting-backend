const express = require('express');
const router = express.Router();
const Service = require('../models/Service');
const ServiceCodes = require('../models/ServiceCodes');


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
  console.log(req.body)
    try {
        const {service,description} = req.body
        const serv = new Service({
            service,description
        })

        await serv.save();
        res.status(201).json(serv);
        
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
})

router.get('/serviceCodes', async (req, res) => {
  try {
    const servicesCodes = await ServiceCodes.find().sort({ createdAt: -1 });
    res.json(servicesCodes);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


router.post('/serviceCodes',async (req,res)=>{
    try {
        const {code,subBrand} = req.body
        const serv = new ServiceCodes({
            code,subBrand
        })
        await serv.save();
        res.status(201).json(serv);
        
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
})



module.exports = router;