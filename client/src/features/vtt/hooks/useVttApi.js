import api from '@/lib/axios';

/**
 * useVttApi — утиліти для REST API VTT ендпоінтів.
 *
 * Патерн використання:
 *   const vttApi = useVttApi(sessionId);
 *   const sheet = await vttApi.loadCharacterSheet();
 *   await vttApi.saveCharacterSheet(data);
 */
export function useVttApi(sessionId) {
  const base = `/sessions/${sessionId}/vtt`;

  return {
    // ─── Character Sheet ─────────────────────────────────────────────────────

    /** Завантажити аркуш персонажа. Повертає null якщо не існує. */
    async loadCharacterSheet() {
      const res = await api.get(`${base}/character`);
      return res.data.data; // null | sheet
    },

    /** Зберегти (upsert) аркуш персонажа. */
    async saveCharacterSheet(data) {
      const res = await api.put(`${base}/character`, data);
      return res.data.data;
    },

    // ─── GM Creatures ─────────────────────────────────────────────────────────

    /** Завантажити список GM-істот. */
    async loadCreatures() {
      const res = await api.get(`${base}/creatures`);
      return res.data.data; // VttGmCreature[]
    },

    /** Bulk-синхронізація GM-бестіарію (весь store → БД). */
    async syncCreatures(creatures) {
      const res = await api.post(`${base}/creatures/sync`, { creatures });
      return res.data.data;
    },

    /** Оновити окрему GM-істоту. */
    async updateCreature(creatureId, data) {
      const res = await api.put(`${base}/creatures/${creatureId}`, data);
      return res.data.data;
    },

    // ─── Dice Log ─────────────────────────────────────────────────────────────

    /** Отримати лог кидків кубиків (limit: кількість записів). */
    async getDiceLog(limit = 50) {
      const res = await api.get(`${base}/dice-log`, { params: { limit } });
      return res.data.data; // VttDiceRoll[]
    },
  };
}
