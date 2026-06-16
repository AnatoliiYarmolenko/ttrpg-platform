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

const createDefaultCreatureData = (type) => ({
  name: type === 'monster' ? 'Новий Ворог' : 'Новий NPC',
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
  tokenBorderColor: type === 'monster' ? '#ef4444' : '#3b82f6', // red for monster, blue for human
  attacks: [],
});

const updateSingleCreatureAttack = (creature, attackId, field, value) => {
  const attacks = creature.data.attacks || [];
  const newAttacks = attacks.map(a => a.id === attackId ? { ...a, [field]: value } : a);
  return { ...creature, data: { ...creature.data, attacks: newAttacks } };
};

const removeSingleCreatureAttack = (creature, attackId) => {
  const attacks = creature.data.attacks || [];
  const newAttacks = attacks.filter(a => a.id !== attackId);
  return { ...creature, data: { ...creature.data, attacks: newAttacks } };
};

const useGmCreaturesStore = create(
  persist(
    (set) => ({
      creatures: [],
      activeTabId: null,

      setActiveTab: (id) => set({ activeTabId: id }),

      addCreature: (type) => set((state) => {
        const id = Date.now().toString() + Math.floor(Math.random() * 1000);
        const defaultData = createDefaultCreatureData(type);
        const newCreature = {
          id,
          type,
          data: {
            ...defaultData,
            stats: { ...defaultData.stats, frontendId: id }
          }
        };
        return {
          creatures: [...state.creatures, newCreature],
          activeTabId: id
        };
      }),

      removeCreature: (id) => set((state) => {
        const newCreatures = state.creatures.filter(c => c.id !== id);
        let newActiveTabId = state.activeTabId;
        if (state.activeTabId === id) {
          newActiveTabId = newCreatures.length > 0 ? newCreatures[newCreatures.length - 1].id : null;
        }
        return {
          creatures: newCreatures,
          activeTabId: newActiveTabId
        };
      }),

      reorderCreatures: (startIndex, endIndex) => set((state) => {
        const newCreatures = Array.from(state.creatures);
        const [removed] = newCreatures.splice(startIndex, 1);
        newCreatures.splice(endIndex, 0, removed);
        return { creatures: newCreatures };
      }),

      updateCreatureData: (id, field, value) => set((state) => {
        const creatures = state.creatures.map(c => {
          if (c.id !== id) return c;
          
          const newData = { ...c.data, [field]: value };
          
          if (field === 'level') {
            let newLevel = Number(value) || 1;
            if (newLevel > 30) newLevel = 30;
            if (newLevel < 1) newLevel = 1;
            newData.level = newLevel;
            newData.proficiencyBonus = Math.ceil(newLevel / 4) + 1;
            newData.hitDiceMax = newLevel;
          }
          
          return { ...c, data: newData };
        });
        return { creatures };
      }),

      updateCreatureStat: (id, stat, value) => set((state) => {
        const creatures = state.creatures.map(c => {
          if (c.id !== id) return c;
          
          let newStatValue = Number(value) || 10;
          if (newStatValue > 30) newStatValue = 30;
          if (newStatValue < 1) newStatValue = 1;
          
          const newData = { ...c.data, stats: { ...c.data.stats, [stat]: newStatValue } };
          
          if (stat === 'dex') {
            newData.initiativeBonus = Math.floor((newStatValue - 10) / 2);
          }
          
          return { ...c, data: newData };
        });
        return { creatures };
      }),

      updateCreatureCoin: (id, coin, value) => set((state) => {
        const creatures = state.creatures.map(c => {
          if (c.id !== id) return c;
          return { ...c, data: { ...c.data, coins: { ...c.data.coins, [coin]: value } } };
        });
        return { creatures };
      }),

      toggleCreatureSavingThrow: (id, stat) => set((state) => {
        const creatures = state.creatures.map(c => {
          if (c.id !== id) return c;
          return { ...c, data: { ...c.data, savingThrows: { ...c.data.savingThrows, [stat]: !c.data.savingThrows[stat] } } };
        });
        return { creatures };
      }),

      toggleCreatureSkill: (id, skill) => set((state) => {
        const creatures = state.creatures.map(c => {
          if (c.id !== id) return c;
          return { ...c, data: { ...c.data, skills: { ...c.data.skills, [skill]: !c.data.skills[skill] } } };
        });
        return { creatures };
      }),

      addCreatureAttack: (id) => set((state) => {
        const creatures = state.creatures.map(c => {
          if (c.id !== id) return c;
          const newAttack = { id: Date.now().toString() + Math.floor(Math.random() * 1000), name: 'Нова атака', bonus: 0, damage: '1d8+3' };
          return { ...c, data: { ...c.data, attacks: [...(c.data.attacks || []), newAttack] } };
        });
        return { creatures };
      }),

      updateCreatureAttack: (id, attackId, field, value) => set((state) => {
        const creatures = state.creatures.map(c => 
          c.id === id ? updateSingleCreatureAttack(c, attackId, field, value) : c
        );
        return { creatures };
      }),

      removeCreatureAttack: (id, attackId) => set((state) => {
        const creatures = state.creatures.map(c => 
          c.id === id ? removeSingleCreatureAttack(c, attackId) : c
        );
        return { creatures };
      }),

      // ─── Server Sync ────────────────────────────────────────────────────────────

      /**
       * Завантажити GM-істот з сервера та гідрувати store.
       * Якщо сервер повертає [] — зберегти поточний store на сервер.
       * @param {number} sessionId
       */
      loadFromServer: async (sessionId) => {
        try {
          const res = await api.get(`/sessions/${sessionId}/vtt/creatures`);
          const dbCreatures = res.data.data;

          if (Array.isArray(dbCreatures) && dbCreatures.length > 0) {
            // Конвертуємо DB-формат → внутрішній (c.data nested structure)
            const creatures = dbCreatures.map((c) => ({
              id: c.stats?.frontendId || String(c.id),         // Використовуємо стабільний frontendId
              type: c.type === 'HUMAN' ? 'human' : 'monster',
              data: {
                name: c.name,
                level: c.level,
                characterClass: c.characterClass ?? '',
                race: c.race ?? '',
                avatarUrl: c.avatarUrl ?? null,
                hpCurrent: c.hpCurrent,
                hpMax: c.hpMax,
                tempHp: c.tempHp,
                ac: c.ac,
                speed: c.speed,
                initiativeBonus: c.initiativeBonus,
                proficiencyBonus: c.proficiencyBonus,
                hitDiceCurrent: c.hitDiceCurrent,
                hitDiceMax: c.hitDiceMax,
                hitDiceType: c.hitDiceType,
                tokenBorderColor: c.tokenBorderColor,
                stats: c.stats ?? createDefaultCreatureData('monster').stats,
                savingThrows: c.savingThrows ?? createDefaultCreatureData('monster').savingThrows,
                skills: c.skills ?? createDefaultCreatureData('monster').skills,
                coins: c.coins ?? { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 },
                attacks: c.attacks ?? [],
              },
            }));

            set({
              creatures,
              activeTabId: creatures[0]?.id ?? null,
            });
          } else if (Array.isArray(dbCreatures) && dbCreatures.length === 0) {
            // БД порожня — зберегти поточний store якщо є істоти
            const { creatures } = useGmCreaturesStore.getState();
            if (creatures.length > 0) {
              await useGmCreaturesStore.getState().syncToServer(sessionId);
            }
          }
        } catch (err) {
          console.warn('[GmCreaturesStore] Failed to load from server', err?.message);
        }
      },

      /**
       * Bulk-синхронізація: весь store → БД (перезаписує поточний список в БД).
       * @param {number} sessionId
       */
      syncToServer: async (sessionId) => {
        try {
          const { creatures } = useGmCreaturesStore.getState();
          // Зберігаємо стабільний frontendId у полі stats перед відправкою, 
          // щоб при оновленні сторінки токени не втрачали зв'язок
          const payload = creatures.map(c => ({
            ...c,
            data: {
              ...c.data,
              stats: { ...c.data.stats, frontendId: c.id }
            }
          }));
          await api.post(`/sessions/${sessionId}/vtt/creatures/sync`, { creatures: payload });
        } catch (err) {
          console.warn('[GmCreaturesStore] Failed to sync to server', err?.message);
        }
      },

    }),
    {
      name: 'ttrpg-gm-creatures-storage',
    }
  )
);

export default useGmCreaturesStore;
