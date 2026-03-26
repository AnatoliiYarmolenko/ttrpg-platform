// src/hooks/useCsrfInit.js
import { useEffect, useState } from "react";
import { fetchCsrfToken } from "../features/auth/api/authApi";
import logger from "../lib/clientLogger";

export const useCsrfInit = () => {
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const initCSRF = async (retries = 3, delay = 1000) => {
      try {
        await fetchCsrfToken();
        logger.info("CSRF Token ініціалізовано успішно.");
        setIsInitialized(true);
      } catch (err) {
        // Перевіряємо, чи це помилка мережі (коли бекенд ще не піднявся)
        const isNetworkError = err.code === "ERR_NETWORK" || err.code === "ECONNREFUSED";

        if (retries > 0 && isNetworkError) {
          logger.info(`Сервер ще запускається... Повторна спроба через ${delay / 1000}с (${retries} залишилось)`);
          // Рекурсивний виклик через таймер
          setTimeout(() => initCSRF(retries - 1, delay * 2), delay);
        } else {
          logger.error("Не вдалося з'єднатися з сервером:", err.message);
          setError(err);
          // Все одно ставимо true, щоб не блокувати додаток вічно,
          // але в error буде записана помилка
          setIsInitialized(true); 
        }
      }
    };

    initCSRF();
  }, []); // Порожній масив залежностей = запуск 1 раз при старті

  return { isInitialized, error };
};