const express = require('express');
const router = express.Router();
const walletController = require('../controllers/wallet.controller');
const { validateBody, validateQuery } = require('../middlewares/validation.middleware');
const { topUpSchema, transactionsQuerySchema } = require('../validation/wallet.validation');
const { authenticateToken } = require('../middlewares/auth.middleware');
const { verifyCSRFToken } = require('../middlewares/csrf.middleware');
const { walletTopUpLimiter } = require('../middlewares/rate-limit.middleware');

router.get('/me', authenticateToken, walletController.getMyWallet);

router.get('/transactions',
  authenticateToken,
  validateQuery(transactionsQuerySchema),
  walletController.getMyTransactions
);

router.post('/top-up',
  authenticateToken,
  walletTopUpLimiter,
  verifyCSRFToken,
  validateBody(topUpSchema),
  walletController.topUp
);

module.exports = router;
