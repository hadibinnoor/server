const jwtVerifier = require('../services/jwtVerifier');
const cognitoService = require('../services/cognito');

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
    console.log('Auth success (Cognito JWKS):', {
      username,
      tokenUse: decoded.token_use || 'unknown',
      groups: decoded['cognito:groups'] || decoded.groups || [],
      allClaims: Object.keys(decoded).filter(k => k.startsWith('cognito:') || k === 'groups')
    });
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
      console.warn('Auth fallback (local JWT):', {
        username: req.user.username,
        tokenUse: req.user.tokenUse
      });
      return next();
    } catch (fallbackError) {
      console.error('Token verification error:', cognitoError?.message || fallbackError?.message);
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
  }
}

module.exports = { authenticateToken, JWT_SECRET };
 
// Admin guard middleware based on Cognito groups claim
async function isAdmin(req, res, next) {
  let rawGroups = req.user && (req.user['cognito:groups'] || req.user.groups || req.user['groups'] || []);
  let groups = Array.isArray(rawGroups) ? rawGroups : (typeof rawGroups === 'string' ? [rawGroups] : []);
  console.log('isAdmin check - initial groups on token:', {
    username: req.user?.username,
    tokenUse: req.user?.tokenUse,
    groups
  });

  // Fallback: if no groups on token, try to fetch from Cognito (AdminListGroupsForUser)
  if (!groups || groups.length === 0) {
    console.log('isAdmin check - no groups on token, attempting Cognito fetch...');
    try {
      await cognitoService.ensureConfigured();
      const fetched = await cognitoService.getUserGroups(req.user.username);
      if (Array.isArray(fetched) && fetched.length > 0) {
        groups = fetched;
        req.user.groups = fetched;
        console.log('isAdmin check - successfully fetched groups from Cognito:', {
          username: req.user?.username,
          fetchedGroups: groups
        });
      } else {
        console.log('isAdmin check - Cognito returned empty groups:', {
          username: req.user?.username,
          fetchedGroups: fetched
        });
      }
    } catch (e) {
      console.warn('isAdmin check - failed fetching user groups from Cognito:', {
        username: req.user?.username,
        error: e?.message,
        errorType: e?.name
      });
    }
  }

  const normalized = (groups || []).map(g => String(g).toLowerCase());
  console.log('isAdmin check - final groups check:', {
    username: req.user?.username,
    originalGroups: groups,
    normalizedGroups: normalized,
    isAdmin: normalized.includes('admins') || normalized.includes('admin')
  });
  
  if (normalized.includes('admins') || normalized.includes('admin')) {
    console.log('✅ Admin access granted');
    return next();
  }
  console.warn('❌ Admin access denied - groups on token/fetched:', groups);
  return res.status(403).json({ error: 'Admin privileges required' });
}

module.exports.isAdmin = isAdmin;