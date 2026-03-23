const GAME_SYSTEMS = Object.freeze([
  { value: 'D&D 5e', label: 'Dungeons & Dragons 5e' },
  { value: 'Pathfinder 2e', label: 'Pathfinder 2nd Edition' },
  { value: 'Call of Cthulhu', label: 'Call of Cthulhu' },
  { value: 'Інша', label: 'Інша система' },
]);

const GAME_SYSTEM_VALUES = Object.freeze(GAME_SYSTEMS.map((system) => system.value));

module.exports = {
  GAME_SYSTEMS,
  GAME_SYSTEM_VALUES,
};
