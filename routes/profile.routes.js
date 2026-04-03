const express = require('express');
const router = express.Router();
const { verifyAuth } = require('../middleware/auth.middleware');
const profileController = require('../controllers/profile.controller');

router.get('/', verifyAuth, profileController.listProfiles);
router.post('/', verifyAuth, profileController.createProfile);
router.put('/:name', verifyAuth, profileController.updateProfile);
router.delete('/:name', verifyAuth, profileController.deleteProfile);
router.post('/import-legacy', verifyAuth, profileController.importLegacy);
router.post('/duplicate/:name', verifyAuth, profileController.duplicateProfile);

module.exports = router;
