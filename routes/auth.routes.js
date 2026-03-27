const express = require('express');
const { login, initAuth } = require('../controllers/auth.controller');

const router = express.Router();

router.post('/login', login);
router.post('/init', initAuth);

module.exports = router;
