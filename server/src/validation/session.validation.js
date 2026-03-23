const crudValidation = require('./session/session-crud.validation');
const calendarValidation = require('./session/session-calendar.validation');
const participantsValidation = require('./session/session-participants.validation');
const campaignValidation = require('./session/session-campaign.validation');

module.exports = {
  ...crudValidation,
  ...calendarValidation,
  ...participantsValidation,
  ...campaignValidation,
};
