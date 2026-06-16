import React, { useRef, useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { User, Shield, Zap, Activity, Heart, Upload, Plus, Book, ChevronDown, ChevronRight, Swords, Trash2, Dices } from 'lucide-react';
import { toast } from '@/stores/useToastStore';

const calcMod = (score) => Math.floor((Number(score) - 10) / 2);
const formatMod = (mod) => (mod >= 0 ? `+${mod}` : `${mod}`);

const SKILLS_MAP = {
  athletics: { label: 'Атлетика', stat: 'str' },
  acrobatics: { label: 'Акробатика', stat: 'dex' },
  sleightOfHand: { label: 'Спритність рук', stat: 'dex' },
  stealth: { label: 'Непомітність', stat: 'dex' },
  arcana: { label: 'Магія', stat: 'int' },
  history: { label: 'Історія', stat: 'int' },
  investigation: { label: 'Розслідування', stat: 'int' },
  nature: { label: 'Природа', stat: 'int' },
  religion: { label: 'Релігія', stat: 'int' },
  animalHandling: { label: 'Поводження з тваринами', stat: 'wis' },
  insight: { label: 'Проникливість', stat: 'wis' },
  medicine: { label: 'Медицина', stat: 'wis' },
  perception: { label: 'Уважність', stat: 'wis' },
  survival: { label: 'Виживання', stat: 'wis' },
  deception: { label: 'Обман', stat: 'cha' },
  intimidation: { label: 'Залякування', stat: 'cha' },
  performance: { label: 'Виступ', stat: 'cha' },
  persuasion: { label: 'Переконання', stat: 'cha' }
};

const STATS_MAP = {
  str: 'СИЛ',
  dex: 'СПР',
  con: 'ВИТ',
  int: 'ІНТ',
  wis: 'МУД',
  cha: 'ХАР'
};

export default function CreatureSheetContent({
  data,
  type = 'player', // 'player' | 'human' | 'monster'
  showNotesBtn = true,
  isGM = false,
  vttConnection,
  rollStrength = 1,
  onToggleNotes,
  callbacks: {
    updateField,
    updateStat,
    updateCoin,
    toggleSavingThrow,
    toggleSkill,
    addAttack,
    updateAttack,
    removeAttack,
    handleAddToken,
    handleRemoveToken
  },
  isTokenOnTable
}) {
  const fileInputRef = useRef(null);
  
  const [localColor, setLocalColor] = useState(data.tokenBorderColor || (type === 'monster' ? '#e74c3c' : '#2ecc71'));
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLocalColor(data.tokenBorderColor || (type === 'monster' ? '#e74c3c' : '#2ecc71'));
  }, [data.tokenBorderColor, type]);
  const [isSkillsExpanded, setIsSkillsExpanded] = useState(() => {
    const saved = localStorage.getItem('vtt-skills-expanded');
    return saved === null ? !isGM : JSON.parse(saved);
  });
  const [isAttacksExpanded, setIsAttacksExpanded] = useState(() => {
    const saved = localStorage.getItem('vtt-attacks-expanded');
    return saved === null ? true : JSON.parse(saved);
  });
  const [isFeaturesExpanded, setIsFeaturesExpanded] = useState(() => {
    const saved = localStorage.getItem('vtt-features-expanded');
    return saved === null ? true : JSON.parse(saved);
  });

  const toggleSkills = () => {
    setIsSkillsExpanded(prev => {
      const next = !prev;
      localStorage.setItem('vtt-skills-expanded', JSON.stringify(next));
      return next;
    });
  };

  const toggleAttacks = () => {
    setIsAttacksExpanded(prev => {
      const next = !prev;
      localStorage.setItem('vtt-attacks-expanded', JSON.stringify(next));
      return next;
    });
  };

  const toggleFeatures = () => {
    setIsFeaturesExpanded(prev => {
      const next = !prev;
      localStorage.setItem('vtt-features-expanded', JSON.stringify(next));
      return next;
    });
  };

  const {
    name, level, characterClass, race, avatarUrl,
    hpCurrent, hpMax, tempHp, ac, speed, initiativeBonus, proficiencyBonus,
    stats, savingThrows, skills, coins, tokenBorderColor,
    hitDiceCurrent, hitDiceMax, hitDiceType
  } = data;

  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        updateField('avatarUrl', reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const rollDice = (rollName, bonus, baseDice = '1d20') => {
    if (!vttConnection?.sendVttDiceRoll) return;
    const formula = bonus >= 0 ? `${baseDice}+${bonus}` : `${baseDice}${bonus}`;
    const strength = rollStrength || 1;
    const finalCharName = (name && name !== 'Без імені') ? name : undefined;
    vttConnection.sendVttDiceRoll(formula, rollName, strength, 'public', finalCharName);
  };

  const handleRollHitDice = () => {
    if (hitDiceCurrent <= 0) {
      alert("Немає доступних костей хітів!");
      return;
    }
    let typeStr = hitDiceType.trim();
    if (!typeStr.startsWith('d')) typeStr = 'd' + typeStr;
    const conMod = calcMod(stats.con || 10);
    rollDice('Кість хітів (Лікування)', conMod, `1${typeStr}`);
    updateField('hitDiceCurrent', hitDiceCurrent - 1);
  };

  const showHitDice = type === 'player';
  const showCoins = type !== 'monster';

  return (
    <div className={`flex flex-col flex-1 p-4 gap-6 overflow-y-auto custom-scrollbar ${type === 'monster' ? 'md:flex-row-reverse' : 'md:flex-row'}`}>
      {/* Left Column: Avatar & Actions */}
      <div className="flex flex-col items-center gap-4 w-40 shrink-0">
        <button 
          type="button"
          className="w-32 h-32 shrink-0 rounded-full border-4 flex items-center justify-center cursor-pointer relative group bg-brand-dark overflow-hidden transition-all outline-none focus:ring-2 focus:ring-brand-accent/50"
          style={{ borderColor: tokenBorderColor }}
          onClick={() => fileInputRef.current?.click()}
        >
          {avatarUrl ? (
            <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
          ) : (
            <User size={64} className="text-brand-light/20" />
          )}
          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center transition-opacity">
            <Upload size={24} className="text-white mb-1" />
            <span className="text-xs text-white font-medium">Завантажити</span>
          </div>
          <input 
            type="file" 
            ref={fileInputRef} 
            className="hidden" 
            accept="image/*"
            onChange={handleAvatarChange}
          />
        </button>

        <div className="w-full">
          <span className="block text-xs text-brand-light/70 mb-1 text-center uppercase tracking-wider">
            Колір токена
          </span>
          <div className="flex items-center justify-center mt-1">
            <input 
              aria-label="Колір токена"
              type="color" 
              value={localColor}
              onChange={(e) => setLocalColor(e.target.value)}
              onBlur={(e) => updateField('tokenBorderColor', e.target.value)}
              className="w-10 h-10 rounded cursor-pointer border-0 p-0 bg-transparent"
            />
          </div>
        </div>

        <div className="mt-auto w-full pt-2 flex flex-col gap-2 h-full">
          {/* Кості Хітів */}
          {showHitDice && (
            <div className="w-full bg-black/30 border border-brand-light/10 rounded-lg p-2 flex flex-col gap-2">
              <span className="block text-[10px] text-brand-light/70 text-center uppercase tracking-wider font-bold">
                Кості хітів
              </span>
              <div className="flex items-center justify-between gap-1">
                <input 
                  aria-label="Поточні кості хітів"
                  type="number" 
                  value={hitDiceCurrent}
                  onChange={(e) => updateField('hitDiceCurrent', Number(e.target.value))}
                  className="w-8 bg-black/40 border border-brand-light/20 rounded px-1 py-1 text-center text-xs font-bold text-white outline-none no-spinners focus:border-brand-accent"
                  title="Поточні"
                />
                <span className="text-brand-light/50 text-xs">/</span>
                <input 
                  type="number" 
                  value={hitDiceMax}
                  onChange={(e) => updateField('hitDiceMax', Number(e.target.value))}
                  className="w-8 bg-black/40 border border-brand-light/20 rounded px-1 py-1 text-center text-xs font-bold text-brand-light/70 outline-none no-spinners focus:border-brand-accent"
                  title="Максимум"
                />
                <input 
                  type="text" 
                  value={hitDiceType}
                  onChange={(e) => updateField('hitDiceType', e.target.value)}
                  className="w-10 bg-black/40 border border-brand-light/20 rounded px-1 py-1 text-center text-xs font-bold text-white outline-none focus:border-brand-accent ml-auto"
                  placeholder="d8"
                  title="Тип кістки (напр. d8)"
                />
              </div>
              <button 
                onClick={handleRollHitDice} 
                className="w-full h-7 text-[11px] border border-brand-light/20 rounded flex items-center justify-center gap-1 mt-1 hover:bg-brand-medium/30 transition-colors text-white"
                title="Кинути кість хітів для лікування"
              >
                <Heart size={12} className="text-red-400" />
                Відпочити
              </button>
            </div>
          )}

          {/* Гаманець (Coins) */}
          {showCoins && (
            <div className="w-full bg-black/30 border border-brand-light/10 rounded-lg p-2 flex flex-col gap-2">
              {[
                { key: 'cp', label: 'Мідні (ММ)', color: 'text-amber-700' },
                { key: 'sp', label: 'Срібні (СМ)', color: 'text-slate-300' },
                { key: 'ep', label: 'Електрум (ЕМ)', color: 'text-indigo-300' },
                { key: 'gp', label: 'Золоті (ЗМ)', color: 'text-yellow-400' },
                { key: 'pp', label: 'Платинові (ПМ)', color: 'text-cyan-100' },
              ].map(coin => (
                <div key={coin.key} className="flex items-center justify-between gap-2" title={coin.label}>
                  <span className={`text-[10px] font-bold uppercase ${coin.color}`}>{coin.label}</span>
                  <input 
                    type="number" 
                    value={coins?.[coin.key] || 0}
                    onChange={(e) => updateCoin(coin.key, Number(e.target.value))}
                    className="w-12 bg-black/40 border border-brand-light/20 rounded px-1 py-1 text-center text-xs font-bold text-white outline-none no-spinners focus:border-brand-accent"
                  />
                </div>
              ))}
            </div>
          )}

          {showNotesBtn && (
            <button 
              onClick={onToggleNotes}
              className="w-full border border-brand-light/20 text-brand-light rounded hover:bg-brand-medium/30 flex items-center justify-center gap-2 mt-1 py-1.5 transition-colors"
            >
              <Book size={18} className="text-brand-accent" />
              Нотатки
            </button>
          )}

          <button 
            onClick={isTokenOnTable ? handleRemoveToken : handleAddToken}
            title={isTokenOnTable ? 'Прибрати токен зі столу' : 'Додати токен на стіл'}
            className={`w-full rounded shadow-lg flex items-center justify-center gap-2 py-2 mt-1 shrink-0 transition-colors ${
              isTokenOnTable
                ? 'bg-red-500/80 text-white hover:bg-red-500 shadow-red-500/20'
                : 'bg-brand-accent text-white hover:bg-brand-accent/80 shadow-brand-accent/20'
            }`}
          >
            {isTokenOnTable ? <Trash2 size={18} /> : <Plus size={18} />}
            {isTokenOnTable ? 'Прибрати токен' : 'Додати Токен'}
          </button>
        </div>
      </div>

      {/* Right Column: Stats & Data */}
      <div className="flex-1 flex flex-col gap-4">
        {/* Header row */}
        <div className="flex items-end gap-4 border-b border-brand-light/10 pb-4">
          <div className="flex-1 flex flex-col gap-2">
            <input 
              type="text" 
              value={name} 
              onChange={(e) => updateField('name', e.target.value)}
              className="w-full bg-transparent border-b-2 border-brand-light/20 focus:border-brand-accent text-2xl font-bold text-white px-1 py-1 outline-none transition-colors placeholder:text-brand-light/30"
              placeholder="Ім'я..."
            />
            <div className="flex gap-2">
              <input 
                type="number" 
                value={level} 
                min="1"
                max="30"
                onChange={(e) => updateField('level', Number(e.target.value))}
                className="w-12 bg-black/40 border border-brand-light/20 rounded px-2 py-1 text-sm text-center text-white outline-none no-spinners"
                placeholder="Рів"
              />
              <input 
                type="text" 
                value={characterClass} 
                onChange={(e) => updateField('characterClass', e.target.value)}
                className="flex-1 bg-black/40 border border-brand-light/20 rounded px-2 py-1 text-sm text-white outline-none placeholder:text-brand-light/30"
                placeholder={type === 'monster' ? 'Тип монстра' : 'Клас'}
              />
              <input 
                type="text" 
                value={race} 
                onChange={(e) => updateField('race', e.target.value)}
                className="flex-1 bg-black/40 border border-brand-light/20 rounded px-2 py-1 text-sm text-white outline-none placeholder:text-brand-light/30"
                placeholder={type === 'monster' ? 'Розмір' : 'Раса'}
              />
            </div>
          </div>
          <div className="flex flex-shrink-0 gap-2">
            <div className="flex flex-col bg-black/20 rounded p-1.5 border border-blue-400/30 focus-within:border-blue-400 transition-colors w-16 items-center justify-center">
              <span className="text-[10px] text-blue-400 font-bold uppercase text-center mb-1">
                Тимч. HP
              </span>
              <input 
                type="number" 
                value={tempHp} 
                onChange={(e) => updateField('tempHp', Number(e.target.value))}
                className="w-full bg-transparent text-center text-blue-200 font-bold outline-none no-spinners text-lg"
              />
            </div>

            <div className="flex flex-col gap-1 w-32 sm:w-36">
              <div className="flex items-center justify-between gap-1 bg-black/40 rounded p-1.5 border border-brand-light/10 focus-within:border-brand-accent transition-colors">
                <span className="text-[10px] text-brand-light/50 font-bold uppercase pl-1">
                  Max HP
                </span>
                <input 
                  type="number" 
                  value={hpMax} 
                  onChange={(e) => updateField('hpMax', Number(e.target.value))}
                  className="w-12 bg-transparent text-right text-brand-light/70 font-bold outline-none no-spinners text-sm"
                />
              </div>
              
              <div className="flex items-center justify-between gap-1 bg-black/40 rounded p-1.5 border border-brand-light/10 relative overflow-hidden group focus-within:border-brand-accent transition-colors">
                <div className="absolute top-0 left-0 bottom-0 w-1 bg-red-500/20" />
                <span className="text-[10px] text-brand-light/70 font-bold uppercase pl-2 flex items-center gap-1">
                  <Heart size={10} className="text-red-400"/>
                  Поточне
                </span>
                <input 
                  type="number" 
                  value={hpCurrent} 
                  onChange={(e) => updateField('hpCurrent', Number(e.target.value))}
                  className="w-12 sm:w-14 bg-transparent text-right text-white font-bold text-lg outline-none no-spinners"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Quick Stats Row */}
        <div className="flex gap-4">
          <div className="flex-1 bg-black/30 rounded-lg p-3 border border-brand-light/10 flex flex-col items-center justify-center">
            <Shield size={16} className="text-brand-light/50 mb-1" />
            <input 
              type="number" 
              value={ac} 
              onChange={(e) => updateField('ac', Number(e.target.value))}
              className="w-12 bg-transparent text-center text-xl font-bold text-white outline-none no-spinners"
            />
            <span className="text-[10px] text-brand-light/70 uppercase">КД</span>
          </div>
          <button type="button" className="flex-1 bg-black/30 rounded-lg p-3 border border-brand-light/10 flex flex-col items-center justify-center group cursor-pointer hover:border-brand-accent/50 outline-none focus:border-brand-accent/50" onClick={() => rollDice('Ініціатива', initiativeBonus)}>
            <Zap size={16} className="text-amber-400/70 mb-1 group-hover:text-amber-400" />
            <input 
              type="number" 
              value={initiativeBonus} 
              onChange={(e) => updateField('initiativeBonus', Number(e.target.value))}
              className="w-12 bg-transparent text-center text-xl font-bold text-white outline-none no-spinners"
              onClick={(e) => e.stopPropagation()}
            />
            <span className="text-[10px] text-brand-light/70 uppercase">Ініціатива</span>
          </button>
          <div className="flex-1 bg-black/30 rounded-lg p-3 border border-brand-light/10 flex flex-col items-center justify-center">
            <Activity size={16} className="text-cyan-400/70 mb-1" />
            <div className="flex items-center">
              <input 
                type="number" 
                value={speed} 
                onChange={(e) => updateField('speed', Number(e.target.value))}
                className="w-10 bg-transparent text-center text-xl font-bold text-white outline-none no-spinners"
              />
              <span className="text-sm text-brand-light/50">фут</span>
            </div>
            <span className="text-[10px] text-brand-light/70 uppercase">Швидкість</span>
          </div>
          <div className="flex-1 bg-black/30 rounded-lg p-3 border border-brand-accent/30 flex flex-col items-center justify-center relative overflow-hidden">
            <div className="absolute top-0 right-0 w-8 h-8 bg-brand-accent/10 rounded-bl-full" />
            <span className="text-xs text-brand-accent mb-1 font-bold">БМ</span>
            <div className="flex items-center">
              <span className="text-xl font-bold text-white">+</span>
              <input 
                type="number" 
                value={proficiencyBonus} 
                onChange={(e) => updateField('proficiencyBonus', Number(e.target.value))}
                className="w-8 bg-transparent text-center text-xl font-bold text-white outline-none no-spinners"
              />
            </div>
            <span className="text-[10px] text-brand-light/70 uppercase">Бонус</span>
          </div>
        </div>

        {/* Main Stats & Saving Throws */}
        <div className="flex justify-between gap-2">
          {Object.entries(STATS_MAP).map(([key, label]) => {
            const score = stats[key] || 10;
            const mod = calcMod(score);
            const isSaveProficient = savingThrows[key] || false;
            const saveBonus = mod + (isSaveProficient ? proficiencyBonus : 0);

            return (
              <div key={key} className="flex-1 flex flex-col items-center gap-1">
                {/* Stat Box */}
                <button type="button" className="w-full bg-black/40 rounded-lg border border-brand-light/10 flex flex-col items-center pb-2 pt-1 relative cursor-pointer hover:border-brand-accent/50 transition-colors outline-none focus:border-brand-accent/50" onClick={() => rollDice(`Перевірка: ${label}`, mod)}>
                  <span className="text-[10px] font-bold text-brand-light/70 uppercase tracking-wider mb-1">{label}</span>
                  <div className="text-xl font-bold text-white mb-2">
                    {formatMod(mod)}
                  </div>
                  <div className="w-10 h-8 bg-brand-dark rounded border border-brand-light/20 flex items-center justify-center absolute -bottom-3 shadow-md">
                    <input 
                      type="number" 
                      value={score} 
                      min="1"
                      max="30"
                      onChange={(e) => updateStat(key, Number(e.target.value))}
                      onClick={(e) => e.stopPropagation()}
                      className="w-full bg-transparent text-center text-sm font-medium text-brand-light outline-none no-spinners"
                    />
                  </div>
                </button>
                {/* Saving Throw */}
                <div className="mt-4 flex items-center justify-between gap-1 w-full bg-black/20 rounded p-1 group hover:bg-white/5 transition-colors">
                  <button 
                    type="button"
                    aria-label={`Спасбросок: ${label}`}
                    className={`w-3 h-3 rounded-full border flex-shrink-0 cursor-pointer outline-none focus:ring-1 focus:ring-brand-accent ${isSaveProficient ? 'bg-brand-accent border-brand-accent' : 'border-brand-light/40'}`} 
                    onClick={(e) => { e.stopPropagation(); toggleSavingThrow(key); }}
                  />
                  <button
                    type="button"
                    className="flex flex-1 items-center justify-center gap-1 cursor-pointer outline-none focus:text-brand-accent"
                    onClick={() => rollDice(`Спасбросок: ${label}`, saveBonus)}
                  >
                    <span className="text-[10px] font-bold text-brand-light/50">СПАС</span>
                    <span className="text-xs font-bold text-white">{formatMod(saveBonus)}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Accordions */}
        <div className="mt-2 flex-1 flex flex-col gap-4">
          
          {/* Skills Accordion */}
          <div>
            <button 
              type="button"
              className="w-full flex items-center gap-2 cursor-pointer mb-2 pb-1 border-b border-brand-light/10 group outline-none focus:border-brand-accent/50"
              onClick={toggleSkills}
            >
              {isSkillsExpanded ? <ChevronDown size={14} className="text-brand-light/50 group-hover:text-white" /> : <ChevronRight size={14} className="text-brand-light/50 group-hover:text-white" />}
              <h3 className="text-xs font-bold text-brand-light/50 uppercase tracking-widest group-hover:text-white transition-colors">Навички (Skills)</h3>
            </button>
            
            {isSkillsExpanded && (
              <div className="grid grid-cols-2 gap-x-6 gap-y-1 pl-6">
                {Object.entries(SKILLS_MAP).map(([key, { label, stat }]) => {
                  const isProficient = skills[key] || false;
                  const statMod = calcMod(stats[stat] || 10);
                  const totalBonus = statMod + (isProficient ? proficiencyBonus : 0);
                  
                  return (
                    <div 
                      key={key} 
                      className="w-full flex items-center justify-between py-1 group hover:bg-white/5 px-2 rounded -mx-2 transition-colors"
                    >
                      <div className="flex items-center gap-2 flex-1">
                        <button 
                          type="button"
                          aria-label={`Навичка: ${label}`}
                          className={`w-3 h-3 rounded-full border flex-shrink-0 cursor-pointer transition-colors outline-none focus:ring-1 focus:ring-brand-accent ${isProficient ? 'bg-brand-accent border-brand-accent' : 'border-brand-light/40'}`} 
                          onClick={(e) => { e.stopPropagation(); toggleSkill(key); }}
                        />
                        <button
                          type="button"
                          className="flex flex-1 items-center gap-2 cursor-pointer outline-none focus:text-brand-accent text-left"
                          onClick={() => rollDice(`Навичка: ${label}`, totalBonus)}
                        >
                          <span className="text-[10px] font-bold text-brand-light/40 uppercase w-6">{STATS_MAP[stat]}</span>
                          <span className={`text-sm flex-1 ${isProficient ? 'text-white' : 'text-brand-light/80'}`}>{label}</span>
                          <div className={`text-sm font-bold w-6 text-right ${isProficient ? 'text-brand-accent' : 'text-brand-light/60'}`}>
                            {formatMod(totalBonus)}
                          </div>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Features Accordion (GM only) */}
          {isGM && (
            <div>
              <button 
                type="button"
                className="w-full flex items-center gap-2 cursor-pointer mb-2 pb-1 border-b border-brand-light/10 group outline-none focus:border-brand-accent/50"
                onClick={toggleFeatures}
              >
                {isFeaturesExpanded ? <ChevronDown size={14} className="text-brand-light/50 group-hover:text-white" /> : <ChevronRight size={14} className="text-brand-light/50 group-hover:text-white" />}
                <Book size={14} className="text-brand-light/50 group-hover:text-white" />
                <h3 className="text-xs font-bold text-brand-light/50 uppercase tracking-widest group-hover:text-white transition-colors">Особливості</h3>
              </button>
              
              {isFeaturesExpanded && (
                <div className="flex-1 min-h-[240px] w-full flex flex-col pl-6">
                  <textarea
                    value={data.features || ''}
                    onChange={(e) => updateField('features', e.target.value)}
                    placeholder="Здібності, імунітети, опис..."
                    className="flex-1 w-full bg-black/30 border border-brand-light/20 rounded p-2 text-xs text-white placeholder:text-brand-light/30 focus:border-brand-accent outline-none resize-none custom-scrollbar"
                  />
                </div>
              )}
            </div>
          )}

          {/* Attacks Accordion */}
          <div>
            <div 
              className="flex items-center justify-between mb-2 pb-1 border-b border-brand-light/10 group"
            >
              <button
                type="button"
                className="w-full flex items-center gap-2 cursor-pointer outline-none focus:text-brand-accent"
                onClick={toggleAttacks}
              >
                {isAttacksExpanded ? <ChevronDown size={14} className="text-brand-light/50 group-hover:text-white" /> : <ChevronRight size={14} className="text-brand-light/50 group-hover:text-white" />}
                <Swords size={14} className="text-brand-light/50 group-hover:text-white" />
                <h3 className="text-xs font-bold text-brand-light/50 uppercase tracking-widest group-hover:text-white transition-colors">Атаки</h3>
              </button>
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  if (addAttack) addAttack();
                }}
                className="text-brand-light/50 hover:text-white p-1 rounded-full hover:bg-white/10 transition-colors"
                title="Додати атаку"
              >
                <Plus size={14} />
              </button>
            </div>
            
            {isAttacksExpanded && (
              <div className="flex flex-col gap-2 pl-6">
                {(data.attacks || []).map(attack => (
                  <div key={attack.id} className="flex items-center gap-1 sm:gap-2 bg-black/30 border border-brand-light/10 rounded-lg p-1.5 pr-2 group hover:bg-white/5 transition-colors">
                    <input 
                      type="text" 
                      value={attack.name || ''}
                      onChange={(e) => updateAttack?.(attack.id, 'name', e.target.value)}
                      className="bg-transparent text-sm font-bold text-white outline-none px-1 flex-1 min-w-[60px]"
                      placeholder="Назва"
                    />
                    
                    <div className="w-px h-5 bg-brand-light/10 flex-shrink-0" />

                    <div className="flex items-center gap-1 flex-shrink-0">
                      <span className="text-[10px] text-brand-light/50 font-bold hidden sm:inline">МОД. ВЛУЧАННЯ</span>
                      <div className="flex items-center ml-1">
                        {(attack.bonus || 0) >= 0 && <span className="text-sm font-bold text-brand-accent">+</span>}
                        <input 
                          type="number"
                          value={attack.bonus || 0}
                          onChange={(e) => updateAttack?.(attack.id, 'bonus', Number(e.target.value))}
                          className="bg-transparent text-sm font-bold text-brand-accent w-6 text-center outline-none no-spinners"
                        />
                      </div>
                      <button 
                        onClick={() => rollDice(`Атака: ${attack.name}`, attack.bonus || 0)}
                        className="text-brand-light/50 hover:text-brand-accent p-0.5"
                      >
                        <Dices size={14} />
                      </button>
                    </div>

                    <div className="w-px h-5 bg-brand-light/10 flex-shrink-0" />

                    <div className="flex items-center gap-1 flex-shrink-0">
                      <span className="text-[10px] text-brand-light/50 font-bold hidden sm:inline">ШКОДА</span>
                      <input 
                        type="text"
                        value={attack.damage || ''}
                        onChange={(e) => updateAttack?.(attack.id, 'damage', e.target.value)}
                        className="bg-transparent text-sm font-bold text-red-400 w-24 sm:w-32 outline-none text-center"
                        placeholder="1d8"
                      />
                      <button 
                        onClick={() => {
                          if (!vttConnection?.sendVttDiceRoll) return;
                          
                          let dmgFormula = attack.damage || '0';
                          let wasModified = false;
                          
                          dmgFormula = dmgFormula.replace(/(\d*)\s*([dдкkвlлr])\s*(\d+)/gi, (match, count, letter, sides) => {
                            return `${count || '1'}d${sides}`;
                          });

                          dmgFormula = dmgFormula.replace(/(\d+)[dдкkвlлr]\d+/gi, (match, countStr) => {
                            const count = Number.parseInt(countStr, 10);
                            if (count > 20) {
                              wasModified = true;
                              return match.replace(countStr, '20');
                            }
                            return match;
                          });

                          if (wasModified) {
                            updateAttack?.(attack.id, 'damage', dmgFormula);
                            toast.warning('Ліміт 20 кубиків! Значення автоматично виправлено. Натисніть ще раз для кидка.');
                            return;
                          }

                          const finalCharName = (name && name !== 'Без імені') ? name : undefined;
                          const rollDesc = attack.damageType 
                            ? `Шкода: ${attack.name} [${attack.damageType}]` 
                            : `Шкода: ${attack.name}`;
                          vttConnection.sendVttDiceRoll(dmgFormula, rollDesc, rollStrength || 1, 'public', finalCharName);
                        }}
                        className="text-brand-light/50 hover:text-red-400 p-0.5"
                      >
                        <Dices size={14} />
                      </button>
                      <input 
                        type="text"
                        value={attack.damageType || ''}
                        onChange={(e) => updateAttack?.(attack.id, 'damageType', e.target.value)}
                        className="bg-transparent text-sm text-brand-light/60 w-16 sm:w-24 outline-none placeholder:text-brand-light/20 text-center"
                        placeholder="тип (руб.)"
                      />
                    </div>

                    <button 
                      onClick={() => removeAttack?.(attack.id)}
                      className="text-brand-light/30 hover:text-red-400 p-0.5 ml-1 opacity-0 sm:group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
                {(!data.attacks || data.attacks.length === 0) && (
                  <div className="text-center text-xs text-brand-light/40 py-2">
                    Немає доданих атак.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

CreatureSheetContent.propTypes = {
  data: PropTypes.object.isRequired,
  type: PropTypes.oneOf(['player', 'human', 'monster']),
  showNotesBtn: PropTypes.bool,
  isGM: PropTypes.bool,
  vttConnection: PropTypes.object,
  rollStrength: PropTypes.number,
  onToggleNotes: PropTypes.func,
  callbacks: PropTypes.shape({
    updateField: PropTypes.func,
    updateStat: PropTypes.func,
    updateCoin: PropTypes.func,
    toggleSavingThrow: PropTypes.func,
    toggleSkill: PropTypes.func,
    addAttack: PropTypes.func,
    updateAttack: PropTypes.func,
    removeAttack: PropTypes.func,
    handleAddToken: PropTypes.func,
    handleRemoveToken: PropTypes.func
  }).isRequired,
  isTokenOnTable: PropTypes.bool
};
