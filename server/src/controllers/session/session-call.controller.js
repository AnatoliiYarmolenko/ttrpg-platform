const { AppError, ERROR_CODES } = require('../../constants/errors');
const sessionService = require('../../services/session.service');
const { generateTurnCredentials } = require('../../utils/turn.helper');
const config = require('../../config/config');
const { callService } = require('../../call/call.service');

exports.getCallConfig = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Отримуємо сторінку сесії (доступ перевіряється автоматично)
    const sessionPage = await sessionService.getSessionPageById(id, userId);

    const hasAccess = sessionPage.actions.canJoinCall || sessionPage.actions.canStartCall || sessionPage.actions.canEndCall;
    
    if (!hasAccess) {
      throw new AppError(ERROR_CODES.SECURITY_ACCESS_DENIED, 'Access denied to call config');
    }

    const state = callService.getCallState(id);
    
    let iceServers = [];
    
    if (config.turnEnabled) {
      const turnConfig = generateTurnCredentials(userId);
      iceServers.push({
        urls: [config.turnUrl],
        username: turnConfig.username,
        credential: turnConfig.password,
      });
    }

    res.json({
      success: true,
      data: {
        wsCallPath: config.wsCallPath,
        callState: state.callState,
        iceServers,
      }
    });
  } catch (error) {
    next(error);
  }
};
