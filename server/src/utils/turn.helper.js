const crypto = require('node:crypto');
const config = require('../config/config');

/**
* Генерує TURN credentials для користувача
* @param {string|number} userId - Ідентифікатор користувача
* @returns {{username: string, password: string}} - Об'єкт з username та password для TURN
*/
function generateTurnCredentials(userId) {
  const timestamp = Math.floor(Date.now() / 1000) + config.turnCredentialTtlSeconds;
  const username = `${timestamp}:${userId}`;
  
  const hmac = crypto.createHmac('sha1', config.turnSharedSecret);
  hmac.update(username);
  const password = hmac.digest('base64');
  
  return {
    username,
    password,
  };
}

module.exports = {
  generateTurnCredentials,
};
