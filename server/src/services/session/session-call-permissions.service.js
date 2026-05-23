/**
 * Перевірка прав для початку відеодзвінка
 */
const canStartCall = ({ session, isOwner, isConfirmedGm }) => {
  if (!session || session.status !== 'ACTIVE') {
    return false;
  }
  return Boolean(isOwner || isConfirmedGm);
};

/**
 * Перевірка прав для завершення відеодзвінка
 */
const canEndCall = ({ session, isOwner, isConfirmedGm }) => {
  if (!session || session.status !== 'ACTIVE') {
    return false;
  }
  return Boolean(isOwner || isConfirmedGm);
};

/**
 * Перевірка прав для приєднання до відеодзвінка
 */
const canJoinCall = ({ session, isOwner, isConfirmedGm, isParticipant }) => {
  if (!session || session.status !== 'ACTIVE') {
    return false;
  }
  return Boolean(isOwner || isConfirmedGm || isParticipant);
};

module.exports = {
  canStartCall,
  canEndCall,
  canJoinCall,
};
