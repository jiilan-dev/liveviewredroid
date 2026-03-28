const express = require('express');
const { executeAutomation, tapElement, getLogs } = require('../controllers/automation.controller');
const { verifyAuth } = require('../middleware/auth.middleware');

const router = express.Router();

router.get('/logs', verifyAuth, getLogs);
router.post('/execute', verifyAuth, executeAutomation);
router.post('/tap-element', verifyAuth, tapElement);

module.exports = router;
