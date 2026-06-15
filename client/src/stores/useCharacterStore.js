import { create } from 'zustand';
import { persist } from 'zustand/middleware';

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
    (set) => ({
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
      stats: initialStats,
      savingThrows: initialSavingThrows,
      skills: initialSkills,
      hitDiceCurrent: 1,
      hitDiceMax: 1,
      hitDiceType: 'd8',
      coins: { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 },
      tokenBorderColor: '#eab308', // Amber-500 default
      notes: '',
      features: '',
      backpack: '',
      attacks: [],

      updateField: (field, value) => set(() => {
        const updates = { [field]: value };
        // Автоматичний розрахунок Бонусу Майстерності (БМ) при зміні рівня
        if (field === 'level') {
          let newLevel = Number(value) || 1;
          if (newLevel > 30) newLevel = 30;
          if (newLevel < 1) newLevel = 1;
          updates.level = newLevel; // Примусово обмежуємо рівень
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
    }),
    {
      name: 'vtt-character-storage',
    }
  )
);

export default useCharacterStore;
