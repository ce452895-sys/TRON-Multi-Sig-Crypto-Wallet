require('dotenv').config();

const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const routes = require('./routes');
const { errorHandler } = require('./middleware/errorHandler');

const app = express();

app.use(cors());
app.use(express.json());

// Rate limit proposal/sign/broadcast endpoints specifically — these are
// the ones that can move funds or spend sponsor resources.
const sensitiveLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/proposals', sensitiveLimiter);
app.use('/wallets/:address/sponsor-request', sensitiveLimiter);
app.use('/wallets/:address/stake', sensitiveLimiter);

app.use('/', routes);

app.use(errorHandler);

const PORT = process.env.PORT || 4000;

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`TRON multisig wallet backend listening on port ${PORT}`);
  });
}

module.exports = app;
