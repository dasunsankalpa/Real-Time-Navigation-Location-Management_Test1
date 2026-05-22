const express = require('express');
const { createRecentPlace, getRecentPlaces } = require('../controllers/serviceController');

const router = express.Router();

router.get('/', getRecentPlaces);
router.post('/', createRecentPlace);

module.exports = router;
