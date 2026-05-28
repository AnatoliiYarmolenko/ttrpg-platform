const crypto = require('node:crypto');
const config = require('../config/config');

/**
 * Generates time-limited TURN credentials using HMAC.
 * According to draft-uberti-behave-turn-rest-00
 * @param {string|number} userId
 * @returns {{username: string, password: string}}
 */
function generateTurnCredentials(userId) {
  const timestamp = Math.floor(Date.now() / 1000) + config.turnCredentialTtlSeconds;
  // username is timestamp:username
  const username = `${timestamp}:${userId}`;
  
  // password is HMAC-SHA1(username, shared_secret) in base64
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
