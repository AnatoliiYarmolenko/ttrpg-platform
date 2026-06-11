const crypto = require('node:crypto');
const { logger } = require('../lib/logger');

function randomInt(min, max) {
  return crypto.randomInt(min, max + 1);
}

/**
 * Parses a dice formula, rolls the dice, and evaluates the total.
 * 
 * @param {string} formula - e.g., "2d20 + 5", "1d8 + 1d4"
 * @param {string} player - Name of the player making the roll
 * @returns {Object} - Object containing formula, total, details, and player
 */
function rollDice(formula, player = 'Anonymous') {
  const cleanFormula = formula.toLowerCase().replace(/\s+/g, '');
  
  // Find all NdX patterns (e.g. 2d20, d6)
  const dicePattern = /(\d+)?d(\d+)/g;
  const details = [];
  
  let match;
  while ((match = dicePattern.exec(cleanFormula)) !== null) {
    const qty = Number.parseInt(match[1], 10) || 1;
    const sides = Number.parseInt(match[2], 10);
    
    if (sides <= 1) continue;
    
    const rolls = [];
    // Cap at 100 dice to prevent abuse
    const actualQty = Math.min(qty, 100);
    
    for (let i = 0; i < actualQty; i++) {
      rolls.push(randomInt(1, sides));
    }
    
    details.push({
      qty: actualQty,
      sides,
      values: rolls,
      label: `d${sides}`,
      sign: '+',
      // Create a notation string useful for 3d-dice (e.g., "1d20@15")
      resultsNotation: `${actualQty}d${sides}@${rolls.join(',')}`
    });
  }
  
  // Calculate total sum by replacing dice notations with their computed sums
  let evaluatedFormula = cleanFormula;
  let totalDiceSum = 0;
  
  details.forEach(detail => {
    const sum = detail.values.reduce((a, b) => a + b, 0);
    totalDiceSum += sum;
    // Replace only the first occurrence to handle e.g. "1d6 + 1d6"
    const strToReplace = `${detail.qty === 1 ? '(1)?' : detail.qty}d${detail.sides}`;
    evaluatedFormula = evaluatedFormula.replace(new RegExp(strToReplace), sum.toString());
  });
  
  // Quick safe eval for basic math (+ - * /)
  let total = 0;
  try {
    // Only allow numbers and basic math operators
    if (/^[0-9+\-*/().]+$/.test(evaluatedFormula)) {
      total = new Function(`return ${evaluatedFormula}`)();
    } else {
      total = totalDiceSum;
    }
  } catch (e) {
    logger.error({ err: e, formula }, 'Failed to evaluate dice formula');
    total = totalDiceSum;
  }
  
  return {
    player,
    formula,
    total,
    details
  };
}

module.exports = {
  rollDice
};
