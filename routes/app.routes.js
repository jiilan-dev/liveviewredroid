const express = require('express');
const { launchApp } = require('../controllers/app.controller');
const { verifyAuth } = require('../middleware/auth.middleware');

const router = express.Router();

router.post('/launch', verifyAuth, launchApp);

module.exports = router;
