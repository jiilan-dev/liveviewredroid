const express = require('express');
const { executeAutomation, tapElement } = require('../controllers/automation.controller');
const { verifyAuth } = require('../middleware/auth.middleware');

const router = express.Router();

router.post('/execute', verifyAuth, executeAutomation);
router.post('/tap-element', verifyAuth, tapElement);

module.exports = router;
