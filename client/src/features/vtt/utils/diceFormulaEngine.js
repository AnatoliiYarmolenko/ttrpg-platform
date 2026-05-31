/**
 * diceFormulaEngine.js — парсер та обчислювач формул для кубиків.
 *
 * Підтримує:
 * - Прості кидки: 1d20, 2d6
 * - Позитивні модифікатори: 1d20 + 5, 2d6 + 1d4
 * - Негативні модифікатори: 1d20 - 3, 1d20 - 1d4
 * - Складні формули: 2d6 + 1d8 - 2 + 3
 */

/**
 * Парсить формулу у масив токенів.
 * @param {string} formula — рядок формули, напр. "1d20 + 5 - 1d4"
 * @returns {Array<{type: 'dice'|'modifier', sign: '+'|'-', count?: number, sides?: number, value?: number}>}
 */
function parsePartToToken(part) {
  const cleanPart = part.replace(/\s+/g, '');
  if (!cleanPart) return null;

  let sign = '+';
  let value = cleanPart;
  if (value.startsWith('-')) {
    sign = '-';
    value = value.slice(1);
  } else if (value.startsWith('+')) {
    value = value.slice(1);
  }

  const diceRegex = /^(\d*)d(\d+)$/i;
  const diceMatch = diceRegex.exec(value);
  if (diceMatch) {
    const count = diceMatch[1] ? Number.parseInt(diceMatch[1], 10) : 1;
    const sides = Number.parseInt(diceMatch[2], 10);
    return { type: 'dice', sign, count, sides };
  }

  const num = Number.parseInt(value, 10);
  if (!Number.isNaN(num)) {
    return { type: 'modifier', sign, value: num };
  }

  return null;
}

export function parseFormula(formula) {
  if (!formula || typeof formula !== 'string') return [];

  // Прибираємо /r або /roll префікс
  const clean = formula.trim().replace(/^\/r(?:oll)?\s+/i, '').trim();
  if (!clean) return [];

  const parts = clean.match(/[+-]?\s*(?:\d+d\d+|\d+)/gi);
  if (!parts) return [];

  const tokens = [];
  for (const part of parts) {
    const token = parsePartToToken(part);
    if (token) {
      tokens.push(token);
    }
  }

  return tokens;
}

/**
 * Витягує тільки dice-групи для передачі в @3d-dice/dice-box.
 * @param {string} formula
 * @returns {string[]} — напр. ["1d20", "1d4"]
 */
export function extractDiceGroups(formula) {
  const tokens = parseFormula(formula);
  return tokens
    .filter(t => t.type === 'dice')
    .map(t => `${t.count}d${t.sides}`);
}

/**
 * Обчислює підсумок формули на основі токенів та результатів 3D кубиків.
 *
 * @param {Array} tokens — результат parseFormula()
 * @param {Array} diceResults — масив результатів від @3d-dice/dice-box
 *   Кожен елемент: { groupId, sides, value, ... } або подібна структура.
 *   Ми очікуємо масив об'єктів, де кожен об'єкт — один кубик.
 * @returns {{ total: number, details: Array<{label: string, values: number[], sign: string, subtotal: number}> }}
 */
function flattenDiceResults(diceResults) {
  const flatResults = [];
  if (!Array.isArray(diceResults)) return flatResults;

  for (const r of diceResults) {
    if (!r || typeof r !== 'object') continue;

    if (Array.isArray(r.rolls)) {
      for (const die of r.rolls) {
        flatResults.push({ sides: r.sides || die.sides, value: die.value });
      }
    } else if (r.value !== undefined) {
      flatResults.push({ sides: r.sides, value: r.value });
    }
  }
  return flatResults;
}

function getDiceValues(token, flatResults, state) {
  const values = [];
  for (let i = 0; i < token.count; i++) {
    if (state.idx < flatResults.length) {
      values.push(flatResults[state.idx].value);
      state.idx++;
    } else {
      // Fallback: генеруємо випадкове значення
      values.push(Math.floor(Math.random() * token.sides) + 1);
    }
  }
  return values;
}

export function evaluateFormula(tokens, diceResults = []) {
  const flatResults = flattenDiceResults(diceResults);
  const state = { idx: 0 };
  let total = 0;
  const details = [];

  for (const token of tokens) {
    if (token.type === 'dice') {
      const values = getDiceValues(token, flatResults, state);
      const subtotal = values.reduce((sum, v) => sum + v, 0);
      const signedSubtotal = token.sign === '-' ? -subtotal : subtotal;
      total += signedSubtotal;

      details.push({
        label: `${token.count}d${token.sides}`,
        values,
        sign: token.sign,
        subtotal: signedSubtotal,
      });
    } else if (token.type === 'modifier') {
      const signedValue = token.sign === '-' ? -token.value : token.value;
      total += signedValue;

      details.push({
        label: String(token.value),
        values: [],
        sign: token.sign,
        subtotal: signedValue,
      });
    }
  }

  return { total, details };
}

/**
 * Обчислює загальний модифікатор (тільки числові частини) з формули.
 * @param {string} formula
 * @returns {number}
 */
export function getStaticModifier(formula) {
  const tokens = parseFormula(formula);
  return tokens
    .filter(t => t.type === 'modifier')
    .reduce((sum, t) => sum + (t.sign === '-' ? -t.value : t.value), 0);
}
