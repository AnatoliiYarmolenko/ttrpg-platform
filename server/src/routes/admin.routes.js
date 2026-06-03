const express = require('express');
const router = express.Router();
const adminController = require('../controllers/admin.controller');
const { authenticateToken } = require('../middlewares/auth.middleware');
const { requireAdmin } = require('../middlewares/admin.middleware');
const { verifyCSRFToken } = require('../middlewares/csrf.middleware');

router.use(authenticateToken);
router.use(requireAdmin);

router.get('/stats', adminController.getStats);

router.get('/users', adminController.getUsers);

router.get('/campaigns', adminController.getCampaigns);

router.delete('/campaigns/:id', verifyCSRFToken, adminController.deleteCampaign);

router.get('/sessions', adminController.getSessions);

router.delete('/sessions/:id', verifyCSRFToken, adminController.deleteSession);

module.exports = router;
