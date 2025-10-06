const jwt = require('jsonwebtoken');
const jwksRsa = require('jwks-rsa');
const configLoader = require('./configLoader');

class CognitoJWTVerifier {
	constructor() {
		this.userPoolId = process.env.COGNITO_USER_POOL_ID;
		this.region = process.env.AWS_DEFAULT_REGION || process.env.AWS_REGION || 'ap-southeast-2';
		this.clientId = process.env.COGNITO_CLIENT_ID;
		this.jwksClient = null;
		this.initPromise = null;
	}

	async initIfNeeded() {
		if (this.jwksClient && this.userPoolId && this.clientId && this.region) return true;
		if (this.initPromise) return this.initPromise;

		this.initPromise = (async () => {
			// Resolve values from Parameter Store if not present in env
			if (!this.userPoolId) {
				this.userPoolId = await configLoader.getAsync('COGNITO_USER_POOL_ID', { ssmName: '/app/COGNITO_USER_POOL_ID' });
			}
			if (!this.clientId) {
				this.clientId = await configLoader.getAsync('COGNITO_CLIENT_ID', { ssmName: '/app/COGNITO_CLIENT_ID' });
			}
			const region = await configLoader.getAsync('AWS_DEFAULT_REGION', { ssmName: '/app/AWS_DEFAULT_REGION' });
			if (region) this.region = region;

			if (!this.userPoolId || !this.region) {
				return false;
			}

			this.jwksClient = jwksRsa({
				jwksUri: `https://cognito-idp.${this.region}.amazonaws.com/${this.userPoolId}/.well-known/jwks.json`,
				cache: true,
				cacheMaxAge: 600000,
				rateLimit: true,
				jwksRequestsPerMinute: 5
			});
			return true;
		})();

		return this.initPromise;
	}

	getKey(header, callback) {
		this.jwksClient.getSigningKey(header.kid, (err, key) => {
			if (err) return callback(err);
			const signingKey = key.getPublicKey ? key.getPublicKey() : (key.publicKey || key.rsaPublicKey);
			callback(null, signingKey);
		});
	}

	async verifyToken(token) {
		const ok = await this.initIfNeeded();
		if (!ok) throw new Error('Cognito verifier not configured');

		// Peek token to determine token_use (id vs access) to set audience rules appropriately
		let tokenUse;
		try {
			const unverified = jwt.decode(token);
			tokenUse = unverified?.token_use;
		} catch (_) { /* ignore */ }

		const verifyOpts = {
			algorithms: ['RS256'],
			issuer: `https://cognito-idp.${this.region}.amazonaws.com/${this.userPoolId}`
		};
		// Only enforce audience for ID tokens; Cognito access tokens may not have the app client as aud
		if (tokenUse === 'id' && this.clientId) {
			verifyOpts.audience = this.clientId;
		}

		return new Promise((resolve, reject) => {
			jwt.verify(token, this.getKey.bind(this), verifyOpts, (err, decoded) => {
				if (err) {
					reject(new Error(`Token verification failed: ${err.message}`));
				} else {
					resolve(decoded);
				}
			});
		});
	}

	getUsernameFromToken(token) {
		try {
			const decoded = jwt.decode(token, { complete: true });
			if (!decoded || !decoded.payload) {
				throw new Error('Invalid token format');
			}
			return decoded.payload['cognito:username'] || decoded.payload.username || decoded.payload.sub;
		} catch (error) {
			throw new Error(`Failed to extract username from token: ${error.message}`);
		}
	}
}

module.exports = new CognitoJWTVerifier();
