const sessionCrudController = require('./session/session-crud.controller');
const sessionCalendarController = require('./session/session-calendar.controller');
const sessionParticipantsController = require('./session/session-participants.controller');

module.exports = {
  ...sessionCrudController,
  ...sessionCalendarController,
  ...sessionParticipantsController,
};