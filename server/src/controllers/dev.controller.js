const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { prisma } = require('../lib/prisma');
const { setAuthCookies } = require('../utils/cookie.helper');
const { createRawAndHashedToken } = require('../utils/token.helper');
const { jwtSecret } = require('../config/config');

class DevController {
  async magicLogin(req, res, next) {
    try {
      if (process.env.NODE_ENV === 'production' || process.env.ENABLE_DEV_AUTH !== 'true') {
        return res.status(404).json({ error: 'Not Found' });
      }

      const email = req.body.email || 'dev@example.com';
      const username = req.body.username || email.split('@')[0];

      let user = await prisma.user.findUnique({ where: { email } });

      if (!user) {
        user = await prisma.user.create({
          data: {
            email,
            username,
            password: bcrypt.hashSync('DevPassword123!', 10),
            emailVerified: true,
            role: 'USER',
          },
        });
      }

      if (!user.emailVerified) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: { emailVerified: true },
        });
      }

      const accessToken = jwt.sign(
        { id: user.id, username: user.username, role: user.role },
        jwtSecret,
        { expiresIn: '30d' }
      );

      const { rawToken: refreshToken, tokenHash: refreshTokenHash } = createRawAndHashedToken(64);
      const expiresAt = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000); 

      await prisma.refreshToken.create({
        data: { token: refreshTokenHash, userId: user.id, expiresAt },
      });

      setAuthCookies(res, accessToken, refreshToken);

      const csrfToken = req.cookies?.['XSRF-TOKEN'] || res.getHeader('X-CSRF-Token');

      res.status(200).json({
        message: 'MAGIC LOGIN SUCCESSFUL (DEV ONLY)',
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
        },
        accessToken,
        csrfToken,
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new DevController();
