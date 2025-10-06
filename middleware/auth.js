const jwtVerifier = require('../services/jwtVerifier');

const JWT_SECRET = process.env.JWT_SECRET || 'b7326cd06821a43a2a94ff9866f87908';

async function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  // First attempt Cognito verification (RS256 via JWKS)
  try {
    const decoded = await jwtVerifier.verifyToken(token);
    const username = decoded['cognito:username'] || decoded.username || decoded.sub;
    req.user = {
      username: username,
      sub: decoded.sub,
      tokenUse: decoded.token_use || decoded.token_use || 'access',
      accessToken: token, // Store the original access token for Cognito API calls
      ...decoded
    };
    return next();
  } catch (cognitoError) {
    // Fallback: allow local test JWT signed with shared secret
    try {
      const jwt = require('jsonwebtoken');
      const decoded = jwt.verify(token, JWT_SECRET);
      req.user = {
        username: decoded.username || 'testuser',
        sub: decoded.sub || 'test-sub',
        tokenUse: decoded.token_use || 'access',
        accessToken: token, // Store the original access token for Cognito API calls
        ...decoded
      };
      return next();
    } catch (fallbackError) {
      console.error('Token verification error:', cognitoError?.message || fallbackError?.message);
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
  }
}

module.exports = { authenticateToken, JWT_SECRET };
 
// Admin guard middleware based on Cognito groups claim
function isAdmin(req, res, next) {
  const groups = req.user && (req.user['cognito:groups'] || req.user.groups || []);
  if (Array.isArray(groups) && groups.includes('Admins')) {
    return next();
  }
  return res.status(403).json({ error: 'Admin privileges required' });
}

module.exports.isAdmin = isAdmin;