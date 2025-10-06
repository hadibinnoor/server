const express = require('express');
const cognitoService = require('../services/cognito');
// const jwtVerifier = require('../services/jwtVerifier');
const router = express.Router();

// User registration
router.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    // Validate input
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Username, email, and password are required' });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters long' });
    }

    // Ensure Cognito is initialized (supports Parameter Store lazy loading)
    try {
      await cognitoService.ensureConfigured();
    } catch (e) {
      return res.status(503).json({ 
        error: 'Authentication service not configured. Please configure AWS Cognito.' 
      });
    }

        const result = await cognitoService.signUp(username, email, password);
        
        // Since email verification is disabled, user is immediately confirmed
        res.status(201).json({
          success: true,
          userSub: result.userSub,
          message: 'User registered successfully. You can now log in.',
          requiresEmailConfirmation: false
        });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(400).json({ error: error.message });
  }
});

// Email confirmation
router.post('/confirm', async (req, res) => {
  try {
    const { username, confirmationCode } = req.body;

    if (!username || !confirmationCode) {
      return res.status(400).json({ error: 'Username and confirmation code are required' });
    }

    try {
      await cognitoService.ensureConfigured();
    } catch (e) {
      return res.status(503).json({ 
        error: 'Authentication service not configured. Please configure AWS Cognito.' 
      });
    }

    const result = await cognitoService.confirmSignUp(username, confirmationCode);
    res.json(result);
  } catch (error) {
    console.error('Confirmation error:', error);
    res.status(400).json({ error: error.message });
  }
});

// User login - returns Cognito's native JWT tokens
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    // Temporary test user for development (bypass Cognito when credentials are expired)
    if (username === 'testuser' && password === 'password123') {
      const jwt = require('jsonwebtoken');
      const JWT_SECRET = process.env.JWT_SECRET || 'b7326cd06821a43a2a94ff9866f87908';
      
      const token = jwt.sign(
        { 
          username: 'testuser',
          email: 'test@example.com',
          sub: 'test-sub-123',
          token_use: 'access'
        },
        JWT_SECRET,
        { expiresIn: '24h' }
      );

      return res.json({
        success: true,
        idToken: token,
        accessToken: token,
        refreshToken: 'test-refresh-token',
        tokenType: 'Bearer',
        expiresIn: 86400,
        message: 'Login successful (test user)'
      });
    }

    try {
      await cognitoService.ensureConfigured();
    } catch (e) {
      return res.status(503).json({ 
        error: 'Authentication service not configured. Please configure AWS Cognito.' 
      });
    }

    const result = await cognitoService.signIn(username, password);
    
    // Check if MFA is required
    if (result.requiresMFA) {
      return res.json({
        success: false,
        requiresMFA: true,
        challengeName: result.challengeName,
        session: result.session,
        message: result.message
      });
    }
    
    // Return Cognito's native JWT tokens for successful login
    res.json({
      success: true,
      idToken: result.idToken,
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      tokenType: result.tokenType,
      expiresIn: result.expiresIn,
      message: result.message
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(401).json({ error: error.message });
  }
});

// Get user info from ID token
router.get('/user', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    try {
      await cognitoService.ensureConfigured();
    } catch (e) {
      return res.status(503).json({ 
        error: 'Authentication service not configured. Please configure AWS Cognito.' 
      });
    }

    // Temporarily return mock user info, including groups if present
    const jwt = require('jsonwebtoken');
    const decoded = jwt.decode(token);
    const groups = decoded?.['cognito:groups'] || decoded?.groups || [];
    
    console.log('Auth /user endpoint - token analysis:', {
      tokenType: decoded?.token_use,
      username: decoded?.username || decoded?.['cognito:username'],
      allClaims: Object.keys(decoded || {}).filter(k => k.startsWith('cognito:') || k === 'groups'),
      cognitoGroups: decoded?.['cognito:groups'],
      groups: decoded?.groups,
      extractedGroups: groups
    });
    
    res.json({
      username: decoded?.username || decoded?.['cognito:username'] || 'testuser',
      email: decoded?.email || 'test@example.com',
      sub: decoded?.sub || 'test-sub',
      emailVerified: decoded?.email_verified || true,
      tokenUse: decoded?.token_use || 'access',
      groups
    });
  } catch (error) {
    console.error('Get user info error:', error);
    res.status(401).json({ error: 'Invalid token' });
  }
});

// Manual user confirmation (for development when email verification is disabled)
router.post('/confirm-manual', async (req, res) => {
  try {
    const { username } = req.body;

    if (!username) {
      return res.status(400).json({ error: 'Username is required' });
    }

    if (!cognitoService.isConfigured()) {
      return res.status(503).json({ 
        error: 'Authentication service not configured. Please configure AWS Cognito.' 
      });
    }

    // Use AdminConfirmSignUp to manually confirm user
    const { AdminConfirmSignUpCommand } = require('@aws-sdk/client-cognito-identity-provider');
    const command = new AdminConfirmSignUpCommand({
      UserPoolId: process.env.COGNITO_USER_POOL_ID,
      Username: username
    });

    await cognitoService.client.send(command);
    
    res.json({
      success: true,
      message: 'User confirmed successfully. You can now log in.'
    });
  } catch (error) {
    console.error('Manual confirmation error:', error);
    res.status(400).json({ error: error.message });
  }
});

// Get user groups from Cognito (fallback when token doesn't contain groups)
router.get('/user-groups', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    try {
      await cognitoService.ensureConfigured();
    } catch (e) {
      return res.status(503).json({ 
        error: 'Authentication service not configured. Please configure AWS Cognito.' 
      });
    }

    // Decode token to get username
    const jwt = require('jsonwebtoken');
    const decoded = jwt.decode(token);
    const username = decoded?.username || decoded?.['cognito:username'];
    
    console.log('Auth /user-groups endpoint - token decode result:', {
      hasDecoded: !!decoded,
      username: username,
      tokenType: decoded?.token_use,
      allKeys: decoded ? Object.keys(decoded) : []
    });
    
    if (!username) {
      console.log('Auth /user-groups endpoint - no username found in token');
      return res.json({
        username: 'unknown',
        groups: [],
        isAdmin: false,
        error: 'No username found in token'
      });
    }

    console.log('Auth /user-groups endpoint - fetching groups for:', username);

    try {
      // Fetch groups from Cognito
      const groups = await cognitoService.getUserGroups(username);
      console.log('Auth /user-groups endpoint - groups fetched:', groups);
      
      res.json({
        username,
        groups: groups || [],
        isAdmin: groups && (groups.includes('Admins') || groups.includes('Admin'))
      });
    } catch (cognitoError) {
      console.error('Auth /user-groups endpoint - Cognito error:', cognitoError.message);
      
      // Fallback: return empty groups if Cognito fails
      res.json({
        username,
        groups: [],
        isAdmin: false,
        error: 'Failed to fetch groups from Cognito'
      });
    }
  } catch (error) {
    console.error('Get user groups error:', error);
    res.status(401).json({ error: 'Invalid token' });
  }
});

module.exports = router;