import React, { useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import DiceBox from '@3d-dice/dice-box';

/**
 * 3D Dice Roller Wrapper
 * 
 * Creates a full-screen transparent canvas for rolling 3D physics-based dice.
 * Uses @3d-dice/dice-box library.
 * 
 * @param {string} rollTrigger - A formula string (e.g. "1d20", "2d6+2") that triggers a roll when changed.
 * @param {function} onRollComplete - Callback fired when dice stop rolling, passing the final result.
 */
export default function DiceRoller3D({ rollTrigger, onRollComplete }) {
  const diceBoxRef = useRef(null);
  const onRollCompleteRef = useRef(onRollComplete);
  const clearTimerRef = useRef(null);
  const initializedRef = useRef(false);

  // Оновлюємо ref при зміні колбеку
  useEffect(() => {
    onRollCompleteRef.current = onRollComplete;
  }, [onRollComplete]);

  // Зберігаємо оригінальну формулу, щоб передати її разом з результатами
  const lastFormulaRef = useRef(null);

  // Обробник завершення кидка винесено окремо, щоб уникнути глибокої вкладеності (SonarQube)
  const handleRollComplete = (results) => {
    if (onRollCompleteRef.current) {
      // Передаємо оригінальну формулу разом з результатами 3D кубиків
      onRollCompleteRef.current(results, lastFormulaRef.current);
    }
    
    // Автоматично очищаємо кубики через 4 секунди
    if (clearTimerRef.current) {
      clearTimeout(clearTimerRef.current);
    }
    clearTimerRef.current = setTimeout(() => {
      if (diceBoxRef.current) {
        diceBoxRef.current.clear();
      }
    }, 4000);
  };

  // Ініціалізація DiceBox
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    // Створюємо інстанс DiceBox
    const diceBox = new DiceBox('#dice-canvas-container', {
      assetPath: '/assets/dice-box/', // шлях до асетів у public folder
      theme: 'default',
      themeColor: '#8a0303', // Чорно-кровавий / темно-червоний колір
      scale: 7, // Зменшено масштаб (половина від попереднього 14)
      spinForce: 6,
      throwForce: 6,
      gravity: 3,
      mass: 2,
      friction: 0.8,
      restitution: 0.6,
      linearDamping: 0.4,
      angularDamping: 0.4,
      startingHeight: 8,
      settleTimeout: 5000,
      enableTopSettle: true
    });

    // Ініціалізація фізичного рушія
    diceBox.init().then(() => {
      console.log('DiceBox successfully initialized! Ready to roll.');
      diceBoxRef.current = diceBox;
      
      // Примусово викликаємо подію resize, щоб рушій Babylon зрозумів, що контейнер на весь екран
      setTimeout(() => {
        globalThis.dispatchEvent(new Event('resize'));
        
        // Додатковий фікс: якщо канвас не розтягнувся
        const canvas = document.querySelector('#dice-canvas-container canvas');
        if (canvas) {
          canvas.style.width = '100%';
          canvas.style.height = '100%';
        }
      }, 100);
      
      // Підписка на подію завершення кидка
      diceBox.onRollComplete = handleRollComplete;
    }).catch((err) => {
      console.error('Failed to initialize DiceBox:', err);
    });

    // Cleanup при розмонтуванні
    return () => {
      if (clearTimerRef.current) {
        clearTimeout(clearTimerRef.current);
      }
      if (diceBoxRef.current) {
        diceBoxRef.current.clear();
        diceBoxRef.current = null;
      }
    };
  }, []); // Пустий масив залежностей, щоб ініціалізувати лише раз

  // Тригер кидка при зміні rollTrigger
  useEffect(() => {
    if (rollTrigger?.formula && diceBoxRef.current) {
      // Видаляємо "/r " або "/roll " з початку рядка, якщо юзер це ввів
      let cleanFormula = rollTrigger.formula.replace(/^\/r(oll)?\s+/i, '');
      
      // Зберігаємо оригінальну формулу з іменем для використання в handleRollComplete
      lastFormulaRef.current = {
        formula: cleanFormula,
        name: rollTrigger.name || null,
      };

      // Знаходимо всі кубики у формулі (наприклад "3d20", "1d6") і відкидаємо статичні числа (+5)
      // diceBox.roll() краще працює з масивом груп кубиків, коли їх декілька
      const diceGroups = cleanFormula.match(/\d*d\d+/gi) || [];
      
      if (diceGroups.length === 0) {
        console.warn('No valid dice found in formula:', cleanFormula);
        return;
      }

      console.log('Executing diceBox.roll for groups:', diceGroups);
      
      // Якщо ми кидаємо нові кубики, скасовуємо таймер очищення попередніх
      if (clearTimerRef.current) {
        clearTimeout(clearTimerRef.current);
        clearTimerRef.current = null;
      }
      
      // Очищаємо попередні кубики і кидаємо нові (передаємо масив)
      diceBoxRef.current.roll(diceGroups).catch(err => {
        console.error('Roll failed:', err);
      });
    }
  }, [rollTrigger]);

  return (
    <div 
      id="dice-canvas-container"
      className="fixed inset-0 z-40 pointer-events-none flex items-center justify-center"
      style={{ width: '100vw', height: '100vh', margin: 0, padding: 0 }}
    />
  );
}

DiceRoller3D.propTypes = {
  rollTrigger: PropTypes.shape({
    formula: PropTypes.string,
    ts: PropTypes.number,
    name: PropTypes.string,
  }),
  onRollComplete: PropTypes.func
};
