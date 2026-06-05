/**
 * Перевірка прав для відкриття Ігрового столу (VTT).
 * Тільки власник сесії або підтверджений GM може відкрити VTT.
 * VTT можна відкрити лише під час активної сесії та лише якщо воно ще не відкрито.
 */
const canOpenVtt = ({ session, isOwner, isConfirmedGm, isVttOpen }) => {
  if (session?.status !== 'ACTIVE') return false;
  if (isVttOpen) return false; // Вже відкрито — кнопка більше не потрібна
  return Boolean(isOwner || isConfirmedGm);
};

/**
 * Перевірка прав для входу до Ігрового столу (VTT) гравцями.
 * Доступно учасникам сесії після того як GM відкрив VTT.
 */
const canJoinVtt = ({ session, isOwner, isConfirmedGm, isParticipant, isVttOpen }) => {
  if (session?.status !== 'ACTIVE') return false;
  if (!isVttOpen) return false; // VTT ще не відкрито
  return Boolean(isOwner || isConfirmedGm || isParticipant);
};

module.exports = {
  canOpenVtt,
  canJoinVtt,
};
