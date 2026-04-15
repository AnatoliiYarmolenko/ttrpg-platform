const express = require('express');
const router = express.Router();

const clientLogsController = require('../controllers/client-logs.controller');
const { optionalAuthenticateToken } = require('../middlewares/auth.middleware');
const { verifyCSRFToken } = require('../middlewares/csrf.middleware');
const { clientLogLimiter } = require('../middlewares/rate-limit.middleware');

router.post('/', optionalAuthenticateToken, clientLogLimiter, verifyCSRFToken, clientLogsController.ingestClientLog);

module.exports = router;
