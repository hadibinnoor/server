const memjs = require('memjs');
const configLoader = require('./configLoader');

let client = null;
let initPromise = null;

async function getClient() {
	if (client) return client;
	if (initPromise) return initPromise;
	initPromise = (async () => {
		const endpoint = await configLoader.getAsync('MEMCACHED_ENDPOINT', { ssmName: '/app/MEMCACHED_ENDPOINT' });
		if (!endpoint) return null;
		client = memjs.Client.create(endpoint, { timeout: 0.25, retries: 1 });
		return client;
	})();
	return initPromise;
}

function withJitter(seconds) {
	const jitter = Math.floor(seconds * 0.1 * (Math.random() - 0.5));
	return Math.max(1, seconds + jitter);
}

async function cacheGet(key) {
	const c = await getClient();
	if (!c) return null;
	try {
		const { value } = await c.get(key);
		return value ? JSON.parse(value.toString()) : null;
	} catch {
		return null;
	}
}

async function cacheSet(key, obj, ttlSeconds) {
	const c = await getClient();
	if (!c) return;
	try {
		await c.set(key, Buffer.from(JSON.stringify(obj)), { expires: withJitter(ttlSeconds) });
	} catch {}
}

async function cacheDel(key) {
	const c = await getClient();
	if (!c) return;
	try {
		await c.delete(key);
	} catch {}
}

module.exports = { cacheGet, cacheSet, cacheDel };


