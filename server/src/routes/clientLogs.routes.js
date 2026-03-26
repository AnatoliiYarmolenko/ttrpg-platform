const express = require('express');
const router = express.Router();

const clientLogsController = require('../controllers/clientLogs.controller');
const { optionalAuthenticateToken } = require('../middlewares/auth.middleware');
const { verifyCSRFToken } = require('../middlewares/csrf.middleware');
const { clientLogLimiter } = require('../middlewares/rateLimit.middleware');

router.post('/', optionalAuthenticateToken, clientLogLimiter, verifyCSRFToken, clientLogsController.ingestClientLog);

module.exports = router;
