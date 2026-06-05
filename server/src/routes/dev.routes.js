const express = require('express');
const router = express.Router();
const devController = require('../controllers/dev.controller');
const { setCSRFToken } = require('../middlewares/csrf.middleware');

router.use(setCSRFToken);

router.post('/magic-login', devController.magicLogin);

module.exports = router;
