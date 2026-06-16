import React, { useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import DiceBox from '@3d-dice/dice-box-threejs';
import useVttStore from '../../../stores/useVttStore';

/**
 * 3D Dice Roller Wrapper
 * 
 * Creates a full-screen transparent canvas for rolling 3D physics-based dice.
 * Uses @3d-dice/dice-box-threejs library.
 * 
 * @param {object} incomingRoll - The incoming roll object from the server containing formula and precalculated details.
 */
export default function DiceRoller3D({ incomingRoll }) {
  const diceBoxRef = useRef(null);
  const clearTimerRef = useRef(null);
  const initializedRef = useRef(false);
  const lastRollIdRef = useRef(null);
  const announceTimerRef = useRef(null);

  // Обробник завершення кидка (очищення кубиків)
  const handleRollComplete = () => {
    // Автоматично очищаємо кубики через 3 секунди після того як вони зупинились
    if (clearTimerRef.current) {
      clearTimeout(clearTimerRef.current);
    }
    clearTimerRef.current = setTimeout(() => {
      if (diceBoxRef.current) {
        try {
          if (typeof diceBoxRef.current.clear === 'function') {
            diceBoxRef.current.clear();
          } else if (typeof diceBoxRef.current.clearDice === 'function') {
            diceBoxRef.current.clearDice();
          }
        } catch (e) {
          console.warn('Error clearing dice in timeout:', e);
        }
      }
    }, 3000);
  };

  // Ініціалізація DiceBox
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    // Створюємо інстанс DiceBox
    const diceBox = new DiceBox('#dice-canvas-container', {
      assetPath: '/assets/dice-box-threejs/', // шлях до асетів у public folder
      theme_customColorset: {
        background: "#8a0303", // Темно-червоний / кровавий
        foreground: "#ffffff", // Білі цифри
        texture: "marble",     // Текстура мармуру
        material: "wood"       // Змінюємо матеріал на дерево
      },
      shadows: false, // Вимикаємо динамічні тіні для продуктивності
      baseScale: 110, // Зменшили масштаб для оптимізації масових кидків
      gravity_multiplier: 450, // Злегка збільшена гравітація
      strength: 0.5, // Значно зменшена сила кидка (~ 30% від попередньої)
      onRollComplete: handleRollComplete
    });

    // Ініціалізація фізичного рушія
    diceBox.initialize().then(() => {
      diceBoxRef.current = diceBox;
      
      // Примусово викликаємо подію resize
      setTimeout(() => {
        globalThis.dispatchEvent(new Event('resize'));
      }, 100);
    }).catch((err) => {
      console.error('Failed to initialize DiceBox:', err);
    });

    // Cleanup при розмонтуванні
    return () => {
      if (clearTimerRef.current) {
        clearTimeout(clearTimerRef.current);
      }
      if (announceTimerRef.current) {
        clearTimeout(announceTimerRef.current);
      }
      if (diceBoxRef.current) {
        try {
          if (typeof diceBoxRef.current.clear === 'function') {
            diceBoxRef.current.clear();
          } else if (typeof diceBoxRef.current.clearDice === 'function') {
            diceBoxRef.current.clearDice();
          }
        } catch (e) {
          console.warn('Error clearing dice on unmount:', e);
        }
        diceBoxRef.current = null;
      }
    };
  }, []); // Пустий масив залежностей, щоб ініціалізувати лише раз

  // Тригер кидка при зміні incomingRoll
  useEffect(() => {
    if (incomingRoll && incomingRoll.id !== lastRollIdRef.current && diceBoxRef.current) {
      lastRollIdRef.current = incomingRoll.id;
      
      const diceGroups = [];
      const forcedValues = [];
      incomingRoll.details.forEach(detail => {
        if (detail.sides === 100) {
          // За правилами D&D: d100 кидається як два кубика (percentile 00-90 + d10 0-9)
          const actualRolls = detail.values || [];
          for (let i = 0; i < detail.qty; i++) {
            const val = actualRolls[i] || 100;
            let tens = Math.floor(val / 10) * 10;
            let ones = val % 10;
            
            if (val === 100) {
              tens = 0;
              ones = 10;
            } else if (ones === 0) {
              ones = 10;
            } else if (tens === 0) {
              tens = 0;
            }

            diceGroups.push('1d100');
            forcedValues.push(tens);
            
            diceGroups.push('1d10');
            forcedValues.push(ones);
          }
        } else {
          // Collect dice notation, e.g. 1d20 or 2d6
          diceGroups.push(`${detail.qty}d${detail.sides}`);
          // Collect all rolled values for these dice
          if (detail.values && detail.values.length > 0) {
            forcedValues.push(...detail.values);
          }
        }
      });
      
      if (diceGroups.length === 0) {
        console.warn('No valid dice found in incoming roll:', incomingRoll);
        return;
      }

      // For dice-box-threejs, we pass a single string, e.g. '1d20+2d6@15,4,2'
      let rollString = diceGroups.join('+');
      if (forcedValues.length > 0) {
        rollString += `@${forcedValues.join(',')}`;
      }
      
      if (clearTimerRef.current) {
        clearTimeout(clearTimerRef.current);
        clearTimerRef.current = null;
      }

      if (announceTimerRef.current) {
        clearTimeout(announceTimerRef.current);
      }
      
      // Оголошуємо результат через 2.50 секунди після початку кидка 
      announceTimerRef.current = setTimeout(() => {
        const state = useVttStore.getState();
        if (!state.rollHistory.some(r => r.id === incomingRoll.id)) {
          state.addRollResult(incomingRoll);
        }
      }, 2500);
      
      try {
        // Оскільки гравітація дуже висока (330), горизонтальна сила швидко гаситься тертям об стіл.
        // Тому ми використовуємо нелінійний множник, щоб сила дійсно відчувалась:
        // Якщо гравець обрав 3.0, ми множимо це на 4 (буде 12.0). 
        // Якщо 0.1 — буде 0.4.
        const baseStrength = incomingRoll.strength || 1;
        const scaledStrength = baseStrength * 4; 
        
        // Змінюємо безпосередньо властивість (updateConfig не оновлює силу на льоту)
        diceBoxRef.current.strength = scaledStrength;
        
        diceBoxRef.current.roll(rollString).catch(err => {
          console.error('Roll failed with forced values, attempting fallback:', err);
          // Fallback: unforced string e.g. '2d12+1d100'
          const fallbackString = incomingRoll.details.map(d => {
            if (d.sides === 100) return new Array(d.qty).fill('1d100+1d10').join('+');
            return `${d.qty}d${d.sides}`;
          }).join('+');
          diceBoxRef.current.roll(fallbackString).catch(fallbackErr => {
            console.error('Fallback roll also failed:', fallbackErr);
          });
        });
      } catch (e) {
        console.error('Error invoking roll:', e);
      }
    }
  }, [incomingRoll]);

  return (
    <div 
      id="dice-canvas-container"
      className="fixed inset-0 z-[9999] pointer-events-none flex items-center justify-center"
      style={{ width: '100vw', height: '100vh', margin: 0, padding: 0 }}
    />
  );
}

DiceRoller3D.propTypes = {
  incomingRoll: PropTypes.shape({
    id: PropTypes.string,
    formula: PropTypes.string,
    strength: PropTypes.number,
    details: PropTypes.arrayOf(PropTypes.object),
  }),
};
