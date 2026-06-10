const walletService = require('../services/wallet.service');

class WalletController {
  /**
   * GET /api/wallet/me
   * Отримати баланс та гаманець поточного користувача
   */
  async getMyWallet(req, res, next) {
    try {
      const userId = req.user.id;
      const wallet = await walletService.getWallet(userId);
      res.json({ success: true, wallet });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/wallet/transactions
   * Отримати історію транзакцій поточного користувача
   */
  async getMyTransactions(req, res, next) {
    try {
      const userId = req.user.id;
      const { limit, offset } = req.query;

      const data = await walletService.getTransactionHistory(userId, {
        limit,
        offset,
      });

      res.json({ success: true, ...data });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/wallet/top-up
   * Поповнення балансу гаманця поточного користувача
   */
  async topUp(req, res, next) {
    try {
      const userId = req.user.id;
      const { amount } = req.body;

      const updatedWallet = await walletService.topUp(userId, amount);

      res.json({
        success: true,
        message: 'Баланс успішно поповнено',
        wallet: updatedWallet,
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new WalletController();
