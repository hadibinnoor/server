const { 
	CognitoIdentityProviderClient, 
	SignUpCommand, 
	ConfirmSignUpCommand, 
	InitiateAuthCommand, 
	AdminGetUserCommand, 
	AdminCreateUserCommand, 
	AdminSetUserPasswordCommand, 
	AdminConfirmSignUpCommand,
	AssociateSoftwareTokenCommand,
	VerifySoftwareTokenCommand,
	SetUserMFAPreferenceCommand,
	GetUserCommand,
	AdminListGroupsForUserCommand,
	RespondToAuthChallengeCommand
} = require('@aws-sdk/client-cognito-identity-provider');
const crypto = require('crypto');
const configLoader = require('./configLoader');

class CognitoService {
	constructor() {
		this.client = null;
		this.userPoolId = process.env.COGNITO_USER_POOL_ID;
		this.clientId = process.env.COGNITO_CLIENT_ID;
		this.clientSecret = process.env.COGNITO_CLIENT_SECRET;
		this.region = process.env.AWS_DEFAULT_REGION || process.env.AWS_REGION || 'ap-southeast-2';
		this.initPromise = null;
	}

	async initIfNeeded() {
		if (this.client && this.userPoolId && this.clientId) return true;
		if (this.initPromise) return this.initPromise;

		this.initPromise = (async () => {
			// Prefer env, then Parameter Store
			if (!this.userPoolId) {
				this.userPoolId = await configLoader.getAsync('COGNITO_USER_POOL_ID', { ssmName: '/app/COGNITO_USER_POOL_ID' });
			}
			if (!this.clientId) {
				this.clientId = await configLoader.getAsync('COGNITO_CLIENT_ID', { ssmName: '/app/COGNITO_CLIENT_ID' });
			}
			if (!this.clientSecret) {
				this.clientSecret = await configLoader.getAsync('COGNITO_CLIENT_SECRET', { ssmName: '/app/COGNITO_CLIENT_SECRET', withDecryption: true });
			}
			const region = await configLoader.getAsync('AWS_DEFAULT_REGION', { ssmName: '/app/AWS_DEFAULT_REGION' });
			if (region) this.region = region;

			// Initialize client using default credentials provider (instance role)
			this.client = new CognitoIdentityProviderClient({ region: this.region });
			if (this.userPoolId && this.clientId) {
				console.log('Cognito service configured');
				console.log(`User Pool: ${this.userPoolId}, Region: ${this.region}`);
				if (this.clientSecret) console.log('Client secret configured');
				return true;
			}
			console.log('Cognito service not fully configured - set COGNITO_USER_POOL_ID and COGNITO_CLIENT_ID or store in Parameter Store');
			return false;
		})();

		return this.initPromise;
	}

	isConfigured() {
		return this.client !== null && this.userPoolId && this.clientId;
	}

	async ensureConfigured() {
		const ok = await this.initIfNeeded();
		if (!ok) throw new Error('Cognito service not configured. Provide env vars or Parameter Store values.');
	}

	calculateSecretHash(username) {
		if (!this.clientSecret) return undefined;
		return crypto.createHmac('SHA256', this.clientSecret).update(username + this.clientId).digest('base64');
	}

	async confirmUser(username) {
		try {
			const command = new AdminConfirmSignUpCommand({ UserPoolId: this.userPoolId, Username: username });
			await this.client.send(command);
			return true;
		} catch (error) {
			console.error('Auto-confirm user error:', error);
			return false;
		}
	}

	async signUp(username, email, password) {
		await this.ensureConfigured();
		try {
			const secretHash = this.calculateSecretHash(username);
			const commandParams = { ClientId: this.clientId, Username: username, Password: password, UserAttributes: [{ Name: 'email', Value: email }] };
			if (secretHash) commandParams.SecretHash = secretHash;
			const command = new SignUpCommand(commandParams);
			const result = await this.client.send(command);
			const confirmed = await this.confirmUser(username);
			return { success: true, userSub: result.UserSub, codeDeliveryDetails: result.CodeDeliveryDetails, message: confirmed ? 'User registered and confirmed successfully. You can now log in.' : 'User registered successfully. You can now log in.', requiresEmailConfirmation: false, userConfirmed: confirmed };
		} catch (error) {
			console.error('SignUp error:', error);
			if (error.message.includes('Exceeded daily email limit')) {
				throw new Error('Email verification service is temporarily unavailable due to daily limits. Please try again tomorrow or contact support.');
			}
			throw new Error(`Registration failed: ${error.message}`);
		}
	}

	async confirmSignUp(username, confirmationCode) {
		await this.ensureConfigured();
		try {
			const secretHash = this.calculateSecretHash(username);
			const commandParams = { ClientId: this.clientId, Username: username, ConfirmationCode: confirmationCode };
			if (secretHash) commandParams.SecretHash = secretHash;
			const command = new ConfirmSignUpCommand(commandParams);
			await this.client.send(command);
			return { success: true, message: 'Email confirmed successfully. You can now log in.' };
		} catch (error) {
			console.error('ConfirmSignUp error:', error);
			throw new Error(`Email confirmation failed: ${error.message}`);
		}
	}

	async signIn(username, password) {
		await this.ensureConfigured();
		try {
			const secretHash = this.calculateSecretHash(username);
			const authParams = { USERNAME: username, PASSWORD: password };
			if (secretHash) authParams.SECRET_HASH = secretHash;
			const command = new InitiateAuthCommand({ ClientId: this.clientId, AuthFlow: 'USER_PASSWORD_AUTH', AuthParameters: authParams });
			const result = await this.client.send(command);
			
			console.log('SignIn result:', {
				challengeName: result.ChallengeName,
				hasAuthResult: !!result.AuthenticationResult,
				hasSession: !!result.Session
			});
			
			if (result.ChallengeName === 'NEW_PASSWORD_REQUIRED') {
				throw new Error('Password change required. Please contact administrator.');
			}
			
			// Handle MFA challenge
			if (result.ChallengeName === 'SOFTWARE_TOKEN_MFA') {
				console.log('MFA challenge detected for user:', username);
				return { 
					success: false, 
					challengeName: 'SOFTWARE_TOKEN_MFA',
					session: result.Session,
					message: 'MFA required. Please enter your TOTP code.',
					requiresMFA: true
				};
			}
			
			if (result.AuthenticationResult) {
				console.log('Login successful without MFA for user:', username);
				return { 
					success: true, 
					idToken: result.AuthenticationResult.IdToken, 
					accessToken: result.AuthenticationResult.AccessToken, 
					refreshToken: result.AuthenticationResult.RefreshToken, 
					tokenType: result.AuthenticationResult.TokenType, 
					expiresIn: result.AuthenticationResult.ExpiresIn, 
					message: 'Login successful' 
				};
			} else {
				throw new Error('Authentication failed');
			}
		} catch (error) {
			console.error('SignIn error:', error);
			if (error.message.includes('NotAuthorizedException')) {
				throw new Error('Invalid username or password');
			} else if (error.message.includes('UserNotConfirmedException')) {
				throw new Error('Please confirm your email before logging in');
			} else if (error.message.includes('UserNotFoundException')) {
				throw new Error('User not found');
			} else {
				throw new Error(`Login failed: ${error.message}`);
			}
		}
	}

	async getUserInfo(username) {
		await this.ensureConfigured();
		try {
			const command = new AdminGetUserCommand({ UserPoolId: this.userPoolId, Username: username });
			const result = await this.client.send(command);
			const email = result.UserAttributes.find(attr => attr.Name === 'email')?.Value;
			return { username: result.Username, email: email, status: result.UserStatus, enabled: result.Enabled, created: result.UserCreateDate };
		} catch (error) {
			console.error('GetUserInfo error:', error);
			throw new Error(`Failed to get user info: ${error.message}`);
		}
	}

	// MFA Methods
	async associateSoftwareToken(accessToken) {
		await this.ensureConfigured();
		try {
			const command = new AssociateSoftwareTokenCommand({
				AccessToken: accessToken
			});
			const result = await this.client.send(command);
			return result;
		} catch (error) {
			console.error('Associate software token error:', error);
			throw new Error(`Failed to associate software token: ${error.message}`);
		}
	}

	async verifySoftwareToken(accessToken, userCode) {
		await this.ensureConfigured();
		try {
			const command = new VerifySoftwareTokenCommand({
				AccessToken: accessToken,
				UserCode: userCode
			});
			const result = await this.client.send(command);
			return result;
		} catch (error) {
			console.error('Verify software token error:', error);
			throw new Error(`Failed to verify software token: ${error.message}`);
		}
	}

	async setUserMFAPreference(accessToken, mfaOptions) {
		await this.ensureConfigured();
		try {
			const command = new SetUserMFAPreferenceCommand({
				AccessToken: accessToken,
				SoftwareTokenMfaSettings: mfaOptions.softwareTokenMfaSettings
			});
			const result = await this.client.send(command);
			return result;
		} catch (error) {
			console.error('Set MFA preference error:', error);
			throw new Error(`Failed to set MFA preference: ${error.message}`);
		}
	}

	async getUserAttributes(accessToken) {
		await this.ensureConfigured();
		try {
			const command = new GetUserCommand({
				AccessToken: accessToken
			});
			const result = await this.client.send(command);
			return result.UserAttributes;
		} catch (error) {
			console.error('Get user attributes error:', error);
			throw new Error(`Failed to get user attributes: ${error.message}`);
		}
	}

	async getUserMFAOptions(username) {
		await this.ensureConfigured();
		try {
			const command = new AdminGetUserCommand({
				UserPoolId: this.userPoolId,
				Username: username
			});
			const result = await this.client.send(command);
			return result.MFAOptions || [];
		} catch (error) {
			console.error('Get user MFA options error:', error);
			throw new Error(`Failed to get user MFA options: ${error.message}`);
		}
	}

	async getUserMFAStatus(accessToken) {
		await this.ensureConfigured();
		try {
			const command = new GetUserCommand({
				AccessToken: accessToken
			});
			const result = await this.client.send(command);
			
			// Check if user has MFA preferences set
			const mfaOptions = result.MFAOptions || [];
			const userMfaSettingList = result.UserMFASettingList || [];
			
			// Check if SOFTWARE_TOKEN_MFA is in the user's MFA settings
			const hasSoftwareTokenMFA = userMfaSettingList.includes('SOFTWARE_TOKEN_MFA') || 
				mfaOptions.some(option => option.DeliveryMedium === 'SOFTWARE_TOKEN_MFA' || option.AttributeName === 'SOFTWARE_TOKEN_MFA');
			
			return {
				mfaEnabled: hasSoftwareTokenMFA,
				mfaOptions: mfaOptions,
				userMfaSettingList: userMfaSettingList,
				preferredMfaSetting: result.PreferredMfaSetting
			};
		} catch (error) {
			console.error('Get user MFA status error:', error);
			throw new Error(`Failed to get user MFA status: ${error.message}`);
		}
	}

	async getUserGroups(username) {
		await this.ensureConfigured();
		try {
			const command = new AdminListGroupsForUserCommand({
				UserPoolId: this.userPoolId,
				Username: username
			});
			const result = await this.client.send(command);
			return (result.Groups || []).map(g => g.GroupName);
		} catch (error) {
			console.error('Get user groups error:', error);
			throw new Error(`Failed to get user groups: ${error.message}`);
		}
	}

	async respondToMFAChallenge(session, userCode, username = null) {
		await this.ensureConfigured();
		try {
			// Session is a string, not an object. Username should be passed separately if needed for secret hash
			const secretHash = username ? this.calculateSecretHash(username) : undefined;
			const challengeResponses = {
				SOFTWARE_TOKEN_MFA_CODE: userCode
			};

			// Some Cognito app client configurations require USERNAME in ChallengeResponses
			if (username) {
				challengeResponses.USERNAME = username;
			}
			
			// Add SECRET_HASH if client has a secret (required when client has secret)
			if (secretHash) {
				challengeResponses.SECRET_HASH = secretHash;
			}

			const commandParams = {
				ClientId: this.clientId,
				ChallengeName: 'SOFTWARE_TOKEN_MFA',
				Session: session,
				ChallengeResponses: challengeResponses
			};

			console.log('RespondToAuthChallenge parameters:', {
				ClientId: this.clientId,
				ChallengeName: commandParams.ChallengeName,
				hasSession: !!session,
				sessionLength: session?.length,
				challengeResponses: challengeResponses,
				username: username
			});

			const command = new RespondToAuthChallengeCommand(commandParams);
			const result = await this.client.send(command);
			return result;
		} catch (error) {
			console.error('Respond to MFA challenge error:', error);
			throw new Error(`Failed to respond to MFA challenge: ${error.message}`);
		}
	}
}

module.exports = new CognitoService();
