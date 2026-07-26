const express = require('express');
const proposalController = require('../controllers/proposal.controller');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.post('/', requireAuth, proposalController.createProposal);
router.get('/:id', requireAuth, proposalController.getProposal);
router.post('/:id/sign', requireAuth, proposalController.signProposal);
router.post('/:id/broadcast', requireAuth, proposalController.broadcastProposal);

module.exports = router;
