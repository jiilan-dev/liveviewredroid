const express = require('express');
const { getStatus, startSystem, stopSystem, getOverview, getInstances, getScreenshot, sendInput } = require('../controllers/system.controller');
const { verifyAuth } = require('../middleware/auth.middleware');

const router = express.Router();

router.get('/status', verifyAuth, getStatus);
router.get('/overview', verifyAuth, getOverview);
router.get('/instances', verifyAuth, getInstances);
router.get('/screenshot/:port', verifyAuth, getScreenshot);
router.post('/start', verifyAuth, startSystem);
router.post('/stop', verifyAuth, stopSystem);
router.post('/input/:port', verifyAuth, sendInput);

module.exports = router;
