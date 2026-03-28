const express = require('express');
const { getStatus, startSystem, stopSystem, getOverview, getInstances } = require('../controllers/system.controller');
const { verifyAuth } = require('../middleware/auth.middleware');

const router = express.Router();

router.get('/status', verifyAuth, getStatus);
router.get('/overview', verifyAuth, getOverview);
router.get('/instances', verifyAuth, getInstances);
router.post('/start', verifyAuth, startSystem);
router.post('/stop', verifyAuth, stopSystem);

module.exports = router;
