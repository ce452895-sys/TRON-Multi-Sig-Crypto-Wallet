const express = require('express');
const walletController = require('../controllers/wallet.controller');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.post('/', requireAuth, walletController.createWallet);
router.get('/:address', requireAuth, walletController.getWallet);
router.get('/:address/resources', requireAuth, walletController.getWalletResources);
router.post('/:address/stake', requireAuth, walletController.stakeForResources);
router.post('/:address/sponsor-request', requireAuth, walletController.requestSponsorship);
router.delete('/:address/sponsor-request', requireAuth, walletController.revokeSponsorship);

module.exports = router;
