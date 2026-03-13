const securityService = require('../services/security.service');
const { clearAuthCookies } = require('../utils/cookie.helper');

class SecurityController {
  /**
   * PATCH /api/security/password
   * Змінити пароль
   */
  async changePassword(req, res, next) {
    try {
      const userId = req.user.id;
      const { currentPassword, newPassword } = req.body;
      
      await securityService.changePassword(userId, currentPassword, newPassword);
      
      res.json({ 
        success: true, 
        message: 'Пароль успішно змінено',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/security/email
   * Запит на зміну email
   */
  async requestEmailChange(req, res, next) {
    try {
      const userId = req.user.id;
      const { password, newEmail } = req.body;
      
      const result = await securityService.requestEmailChange(userId, password, newEmail);
      
      res.json({ 
        success: true, 
        message: result.message,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/security/confirm-email-change
   * Підтвердити зміну email (публічний, з токеном)
   */
  async confirmEmailChange(req, res, next) {
    try {
      const { token } = req.body;
      
      const profile = await securityService.confirmEmailChange(token);
      
      res.json({ 
        success: true, 
        message: 'Email успішно змінено',
        profile,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /api/security/account
   * Видалити акаунт
   */
  async deleteAccount(req, res, next) {
    try {
      const userId = req.user.id;
      const { password } = req.body;
      
      await securityService.deleteAccount(userId, password);
      
      // Використовуємо централізований helper, щоб опції cookie завжди збігалися
      clearAuthCookies(res);
      
      res.json({ 
        success: true, 
        message: 'Акаунт успішно видалено',
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new SecurityController();
