const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const cognitoService = require('../services/cognito');

// Setup MFA for a user (get QR code)
router.post('/setup', authenticateToken, async (req, res) => {
  try {
    await cognitoService.ensureConfigured();
    
    const username = req.user.username;
    console.log('Setting up MFA for user:', username);
    
    // Associate software token (TOTP) with user
    const result = await cognitoService.associateSoftwareToken(req.user.accessToken);
    
    res.json({
      success: true,
      secretCode: result.SecretCode,
      qrCodeUrl: `otpauth://totp/VideoTranscoding:${username}?secret=${result.SecretCode}&issuer=VideoTranscoding`,
      message: 'Scan the QR code with your authenticator app'
    });
  } catch (error) {
    console.error('MFA setup error:', error);
    res.status(500).json({ 
      error: 'Failed to setup MFA',
      details: error.message 
    });
  }
});

// Verify MFA setup with TOTP code
router.post('/verify-setup', authenticateToken, async (req, res) => {
  try {
    await cognitoService.ensureConfigured();
    
    const { totpCode } = req.body;
    
    if (!totpCode) {
      return res.status(400).json({ error: 'TOTP code is required' });
    }
    
    console.log('Verifying MFA setup for user:', req.user.username);
    
    // Verify the software token
    const result = await cognitoService.verifySoftwareToken(req.user.accessToken, totpCode);
    
    if (result.Status === 'SUCCESS') {
      console.log('TOTP verification successful for user:', req.user.username);
      
      // Set MFA preference to TOTP
      const mfaPreferenceResult = await cognitoService.setUserMFAPreference(req.user.accessToken, {
        softwareTokenMfaSettings: {
          enabled: true,
          preferredMfa: true
        }
      });
      
      console.log('MFA preference set result:', mfaPreferenceResult);
      console.log('MFA has been enabled for user:', req.user.username);
      
      res.json({
        success: true,
        message: 'MFA has been successfully enabled for your account'
      });
    } else {
      res.status(400).json({
        error: 'Invalid TOTP code',
        message: 'Please check your authenticator app and try again'
      });
    }
  } catch (error) {
    console.error('MFA verification error:', error);
    res.status(500).json({ 
      error: 'Failed to verify MFA setup',
      details: error.message 
    });
  }
});

// Get MFA status for current user
router.get('/status', authenticateToken, async (req, res) => {
  try {
    await cognitoService.ensureConfigured();
    
    console.log('Checking MFA status for user:', req.user.username);
    console.log('Token type:', req.user.tokenUse);
    
    // Check if this is a test user (fallback JWT)
    if (req.user.username === 'testuser' || req.user.sub === 'test-sub-123') {
      console.log('Test user detected - MFA not available');
      return res.json({
        success: true,
        mfaEnabled: false,
        mfaOptions: [],
        userMfaSettingList: [],
        preferredMfaSetting: null,
        isTestUser: true
      });
    }
    
    // Use the new MFA status method that checks user preferences
    const mfaStatus = await cognitoService.getUserMFAStatus(req.user.accessToken);
    
    console.log('MFA Status result:', mfaStatus);
    
    res.json({
      success: true,
      mfaEnabled: mfaStatus.mfaEnabled,
      mfaOptions: mfaStatus.mfaOptions,
      userMfaSettingList: mfaStatus.userMfaSettingList,
      preferredMfaSetting: mfaStatus.preferredMfaSetting,
      isTestUser: false
    });
  } catch (error) {
    console.error('MFA status error:', error);
    
    // If it's an invalid access token error, might be test user
    if (error.message.includes('Invalid Access Token')) {
      console.log('Invalid access token - likely test user, returning MFA disabled');
      return res.json({
        success: true,
        mfaEnabled: false,
        mfaOptions: [],
        userMfaSettingList: [],
        preferredMfaSetting: null,
        isTestUser: true
      });
    }
    
    res.status(500).json({ 
      error: 'Failed to get MFA status',
      details: error.message 
    });
  }
});

// Disable MFA for user
router.post('/disable', authenticateToken, async (req, res) => {
  try {
    await cognitoService.ensureConfigured();
    
    console.log('Disabling MFA for user:', req.user.username);
    
    // Set MFA preference to disabled
    await cognitoService.setUserMFAPreference(req.user.accessToken, {
      softwareTokenMfaSettings: {
        enabled: false,
        preferredMfa: false
      }
    });
    
    res.json({
      success: true,
      message: 'MFA has been disabled for your account'
    });
  } catch (error) {
    console.error('MFA disable error:', error);
    res.status(500).json({ 
      error: 'Failed to disable MFA',
      details: error.message 
    });
  }
});

// Handle MFA challenge during login
router.post('/challenge', async (req, res) => {
  try {
    await cognitoService.ensureConfigured();
    
    const { session, totpCode, username } = req.body;
    
    if (!session || !totpCode) {
      return res.status(400).json({ error: 'Session and TOTP code are required' });
    }
    
    // Validate TOTP code format
    if (!/^\d{6}$/.test(totpCode)) {
      return res.status(400).json({ error: 'TOTP code must be 6 digits' });
    }
    
    console.log('Responding to MFA challenge for user:', username);
    console.log('MFA Challenge request data:', {
      hasSession: !!session,
      sessionLength: session?.length,
      sessionPreview: session?.substring(0, 50) + '...',
      totpCodeLength: totpCode?.length,
      username: username
    });
    
    // Additional validation for session length
    if (session.length < 20) {
      console.error('Session too short:', session.length, 'characters');
      return res.status(400).json({ 
        error: 'Invalid session',
        details: 'Session must be at least 20 characters long' 
      });
    }
    
    // Respond to the MFA challenge
    const result = await cognitoService.respondToMFAChallenge(session, totpCode, username);
    
    if (result.AuthenticationResult) {
      res.json({
        success: true,
        accessToken: result.AuthenticationResult.AccessToken,
        idToken: result.AuthenticationResult.IdToken,
        refreshToken: result.AuthenticationResult.RefreshToken,
        message: 'MFA verification successful'
      });
    } else {
      res.status(400).json({
        error: 'Invalid TOTP code',
        message: 'Please check your authenticator app and try again'
      });
    }
  } catch (error) {
    console.error('MFA challenge error:', error);
    res.status(400).json({ 
      error: 'MFA verification failed',
      details: error.message 
    });
  }
});

module.exports = router;
