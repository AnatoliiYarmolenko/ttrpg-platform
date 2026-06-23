const authService = require('../services/auth.service');
const { setAuthCookies, clearAuthCookies, getRefreshTokenFromCookies } = require('../utils/cookie.helper');

class AuthController {

  // Верифікація email
  async verifyEmail(req, res, next) {
    try {
      const { token } = req.query;
      const result = await authService.verifyEmailToken(token);
      if (result.success) {
        res.status(200).json({ success: true, message: 'Email успішно підтверджено!' });
      } else {
        res.status(400).json({ success: false, message: result.message });
      }
    } catch (error) {
      next(error);
    }
  }

  async resendVerification(req, res, next) {
    try {
      const { email } = req.body;
      const result = await authService.resendVerificationEmail(email);
      
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  // Обробка реєстрації
  async register(req, res, next) {
    try {
      const { username, email, password } = req.body;
      await authService.registerUser(username, email, password);
      res.status(201).json({ message: "Користувача створено успішно! Перевірте пошту." });
    } catch (error) {
      next(error);
    }
  }

  // Обробка входу
  async login(req, res, next) {
    try {
      const { email, password } = req.body;
      const data = await authService.loginUser(email, password);

      setAuthCookies(res, data.accessToken, data.refreshToken);

      res.json({ user: data.user });
    } catch (error) {
      next(error);
    }
  }

  // Обробка оновлення токенів
  async refresh(req, res, next) {
    try {
      const refreshToken = getRefreshTokenFromCookies(req);
      const data = await authService.refreshTokens(refreshToken);
      
      setAuthCookies(res, data.accessToken, data.refreshToken);

      res.json({ user: data.user });
    } catch (error) {
      next(error);
    }
  }

  // Обробка виходу
  async logout(req, res, next) {
    try {
      const refreshToken = getRefreshTokenFromCookies(req);
      await authService.revokeRefreshToken(refreshToken);

      clearAuthCookies(res);

      res.json({ message: 'Вихід виконано успішно' });
    } catch (error) {
      next(error);
    }
  }

  // Запит на ресет пароля
  async forgotPassword(req, res, next) {
    try {
      const { email } = req.body;
      const result = await authService.requestPasswordReset(email);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  // Скинути пароль
  async resetPassword(req, res, next) {
    try {
      const { resetToken, newPassword } = req.body;
      const result = await authService.resetPassword(resetToken, newPassword);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new AuthController();