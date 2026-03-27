const express = require('express');
const { getStatus, startSystem, stopSystem } = require('../controllers/system.controller');
const { verifyAuth } = require('../middleware/auth.middleware');

const router = express.Router();

router.get('/status', verifyAuth, getStatus);
router.post('/start', verifyAuth, startSystem);
router.post('/stop', verifyAuth, stopSystem);

module.exports = router;
