const express = require('express');

const router = express.Router();

router.get('/health', (req, res) => res.json({ status: 'ok' }));
router.use('/wallets', require('./wallet.routes'));
router.use('/proposals', require('./proposal.routes'));

module.exports = router;
