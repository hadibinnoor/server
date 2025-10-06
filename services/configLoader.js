const { SSMClient, GetParameterCommand } = require('@aws-sdk/client-ssm');

// Simple config loader that prefers environment variables, then Parameter Store
class ConfigLoader {
	constructor() {
		this.cache = new Map();
		this.ssm = null;
	}

	ensureClient() {
		if (this.ssm) return;
		this.ssm = new SSMClient({
			region: process.env.AWS_DEFAULT_REGION || process.env.AWS_REGION || 'ap-southeast-2'
		});
	}

	// Normalizes parameter names: allow both raw names and prefixed paths
	normalizeName(name) {
		return name.startsWith('/') ? name : `/${name}`;
	}

	// Synchronous get with env+cache only
	get(name) {
		// Prefer explicit env var override
		if (process.env[name]) return process.env[name];
		// Allow alt names that people commonly set (e.g., AWS_REGION)
		if (name === 'AWS_DEFAULT_REGION' && process.env.AWS_REGION) return process.env.AWS_REGION;
		if (this.cache.has(name)) return this.cache.get(name);
		return undefined;
	}

	// Async fetch from SSM if not in env/cache. Caches the value when found.
	async getAsync(name, { withDecryption = false, ssmName } = {}) {
		// env wins
		const envVal = this.get(name);
		if (envVal !== undefined) return envVal;

		// use cached resolved value under the logical name
		if (this.cache.has(name)) return this.cache.get(name);

		try {
			this.ensureClient();
			const parameterName = ssmName ? ssmName : this.normalizeName(name);
			const cmd = new GetParameterCommand({ Name: parameterName, WithDecryption: withDecryption });
			const resp = await this.ssm.send(cmd);
			const value = resp?.Parameter?.Value;
			if (value !== undefined) {
				this.cache.set(name, value);
				return value;
			}
			return undefined;
		} catch (err) {
			// Non-fatal: fall back to undefined so caller can decide
			return undefined;
		}
	}
}

module.exports = new ConfigLoader();
