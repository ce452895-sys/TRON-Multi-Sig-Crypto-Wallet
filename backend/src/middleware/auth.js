const jwt = require('jsonwebtoken');

/**
 * Verifies a signer's JWT and attaches the decoded payload to req.auth.
 * Actual signer identity for on-chain actions still comes from the
 * request body's address fields — this middleware only proves the caller
 * is authenticated, it doesn't itself authorize which wallet they can act
 * on. Add wallet-membership checks in the controller/service layer as
 * this grows past scaffold stage.
 */
function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Missing bearer token' });
  }

  try {
    req.auth = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

module.exports = { requireAuth };
