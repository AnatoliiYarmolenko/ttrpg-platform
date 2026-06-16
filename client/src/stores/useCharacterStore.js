import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import api from '@/lib/axios';

const initialStats = { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };
const initialSavingThrows = { str: false, dex: false, con: false, int: false, wis: false, cha: false };
const initialSkills = {
  acrobatics: false, animalHandling: false, arcana: false, athletics: false,
  deception: false, history: false, insight: false, intimidation: false,
  investigation: false, medicine: false, nature: false, perception: false,
  performance: false, persuasion: false, religion: false, sleightOfHand: false,
  stealth: false, survival: false
};

const useCharacterStore = create(
  persist(
    (set, get) => ({
      name: 'Без імені',
      level: 1,
      characterClass: '',
      race: '',
      avatarUrl: null,
      hpCurrent: 10,
      hpMax: 10,
      tempHp: 0,
      ac: 10,
      speed: 30,
      initiativeBonus: 0,
      proficiencyBonus: 2,
      stats: { ...initialStats },
      savingThrows: { ...initialSavingThrows },
      skills: { ...initialSkills },
      hitDiceCurrent: 1,
      hitDiceMax: 1,
      hitDiceType: 'd8',
      coins: { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 },
      tokenBorderColor: '#eab308', // Amber-500 default
      notes: '',
      features: '',
      backpack: '',
      attacks: [],

      // Службовий прапорець — чи синхронізовано з сервером у цій сесії
      _serverSynced: false,

      updateField: (field, value) => set(() => {
        const updates = { [field]: value };
        // Автоматичний розрахунок Бонусу Майстерності (БМ) при зміні рівня
        if (field === 'level') {
          let newLevel = Number(value) || 1;
          if (newLevel > 30) newLevel = 30;
          if (newLevel < 1) newLevel = 1;
          updates.level = newLevel;
          // Рівні 1-4: +2, 5-8: +3, 9-12: +4, 13-16: +5, 17-20: +6... 29-30: +9
          updates.proficiencyBonus = Math.ceil(newLevel / 4) + 1;
          // Максимальна кількість костей хітів дорівнює рівню персонажа
          updates.hitDiceMax = newLevel;
        }
        return updates;
      }),

      updateStat: (stat, value) => set((state) => {
        let newStatValue = Number(value) || 10;
        if (newStatValue > 30) newStatValue = 30;
        if (newStatValue < 1) newStatValue = 1;

        const newStats = { ...state.stats, [stat]: newStatValue };
        const updates = { stats: newStats };
        // Автоматичний розрахунок Ініціативи при зміні Спритності (DEX)
        if (stat === 'dex') {
          updates.initiativeBonus = Math.floor((newStatValue - 10) / 2);
        }
        return updates;
      }),

      updateCoin: (coin, value) => set((state) => ({ coins: { ...state.coins, [coin]: value } })),
      toggleSavingThrow: (stat) => set((state) => ({ savingThrows: { ...state.savingThrows, [stat]: !state.savingThrows[stat] } })),
      toggleSkill: (skill) => set((state) => ({ skills: { ...state.skills, [skill]: !state.skills[skill] } })),

      addAttack: () => set((state) => ({
        attacks: [...state.attacks, { id: Date.now().toString() + Math.floor(Math.random() * 1000), name: 'Нова атака', bonus: 0, damage: '1d8+3' }]
      })),
      updateAttack: (id, field, value) => set((state) => ({
        attacks: state.attacks.map(a => a.id === id ? { ...a, [field]: value } : a)
      })),
      removeAttack: (id) => set((state) => ({
        attacks: state.attacks.filter(a => a.id !== id)
      })),

      // ─── Server Sync ──────────────────────────────────────────────────────

      /**
       * Завантажити аркуш персонажа з сервера та гідрувати store.
       * Якщо сервер повертає null — зберегти поточний localStorage-стан на сервер.
       * @param {number} sessionId
       */
      loadFromServer: async (sessionId) => {
        try {
          const res = await api.get(`/sessions/${sessionId}/vtt/character`);
          const sheet = res.data.data;

          if (sheet) {
            // Гідруємо store даними з БД (авторитетне джерело)
            set({
              name: sheet.name ?? 'Без імені',
              level: sheet.level ?? 1,
              characterClass: sheet.characterClass ?? '',
              race: sheet.race ?? '',
              avatarUrl: sheet.avatarUrl ?? null,
              hpCurrent: sheet.hpCurrent ?? 10,
              hpMax: sheet.hpMax ?? 10,
              tempHp: sheet.tempHp ?? 0,
              ac: sheet.ac ?? 10,
              speed: sheet.speed ?? 30,
              initiativeBonus: sheet.initiativeBonus ?? 0,
              proficiencyBonus: sheet.proficiencyBonus ?? 2,
              hitDiceCurrent: sheet.hitDiceCurrent ?? 1,
              hitDiceMax: sheet.hitDiceMax ?? 1,
              hitDiceType: sheet.hitDiceType ?? 'd8',
              tokenBorderColor: sheet.tokenBorderColor ?? '#eab308',
              stats: sheet.stats ?? { ...initialStats },
              savingThrows: sheet.savingThrows ?? { ...initialSavingThrows },
              skills: sheet.skills ?? { ...initialSkills },
              coins: sheet.coins ?? { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 },
              attacks: sheet.attacks ?? [],
              notes: sheet.notes ?? '',
              features: sheet.features ?? '',
              backpack: sheet.backpack ?? '',
              _serverSynced: true,
            });
          } else {
            // Аркуша немає в БД — зберігаємо поточний localStorage
            await get().saveToServer(sessionId);
          }
        } catch (err) {
          // Тихий fallback — залишаємо localStorage-дані
          console.warn('[CharacterStore] Failed to load from server, using local data', err?.message);
        }
      },

      /**
       * Зберегти поточний стан store на сервер (upsert).
       * @param {number} sessionId
       */
      saveToServer: async (sessionId) => {
        try {
          const state = get();
          await api.put(`/sessions/${sessionId}/vtt/character`, {
            name: state.name,
            level: state.level,
            characterClass: state.characterClass,
            race: state.race,
            avatarUrl: state.avatarUrl,
            hpCurrent: state.hpCurrent,
            hpMax: state.hpMax,
            tempHp: state.tempHp,
            ac: state.ac,
            speed: state.speed,
            initiativeBonus: state.initiativeBonus,
            proficiencyBonus: state.proficiencyBonus,
            hitDiceCurrent: state.hitDiceCurrent,
            hitDiceMax: state.hitDiceMax,
            hitDiceType: state.hitDiceType,
            tokenBorderColor: state.tokenBorderColor,
            stats: state.stats,
            savingThrows: state.savingThrows,
            skills: state.skills,
            coins: state.coins,
            attacks: state.attacks,
            notes: state.notes,
            features: state.features,
            backpack: state.backpack,
          });
          set({ _serverSynced: true });
        } catch (err) {
          console.warn('[CharacterStore] Failed to save to server', err?.message);
        }
      },
    }),
    {
      name: 'vtt-character-storage',
      // Не зберігаємо службові поля у localStorage
      partialize: (state) => {
        // eslint-disable-next-line no-unused-vars
        const { _serverSynced, loadFromServer, saveToServer, ...persisted } = state;
        return persisted;
      },
    }
  )
);

export default useCharacterStore;
