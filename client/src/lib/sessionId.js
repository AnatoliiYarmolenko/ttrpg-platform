// Генерується один раз при ініціалізації додатку
// crypto.randomUUID() підтримується в сучасних браузерах (Chrome 92+, Firefox 95+, Safari 15.4+)
const SESSION_ID = crypto.randomUUID();

export const getSessionId = () => SESSION_ID;
