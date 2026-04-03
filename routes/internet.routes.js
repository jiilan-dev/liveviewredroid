const express = require('express');
const { getInternetStatus, customPing, fixInternet } = require('../controllers/internet.controller');
const { verifyAuth } = require('../middleware/auth.middleware');

const router = express.Router();

router.get('/status', verifyAuth, getInternetStatus);
router.post('/ping', verifyAuth, customPing);
router.post('/fix', verifyAuth, fixInternet);

module.exports = router;
