const express = require('express');
const router = express.Router();
const walletController = require('../controllers/wallet.controller');
const { validateBody } = require('../middlewares/validation.middleware');
const { topUpSchema } = require('../validation/wallet.validation');
const { authenticateToken } = require('../middlewares/auth.middleware');
const { verifyCSRFToken } = require('../middlewares/csrf.middleware');
const { walletTopUpLimiter } = require('../middlewares/rate-limit.middleware');

router.get('/me', authenticateToken, walletController.getMyWallet);

router.get('/transactions', authenticateToken, walletController.getMyTransactions);

router.post('/top-up',
  authenticateToken,
  walletTopUpLimiter,
  verifyCSRFToken,
  validateBody(topUpSchema),
  walletController.topUp
);

module.exports = router;
