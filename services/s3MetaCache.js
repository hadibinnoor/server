const { cacheGet, cacheSet } = require('./cache');
const s3Service = require('./s3');

async function getHeadCached(key) {
	const ck = `s3:head:${key}`;
	const cached = await cacheGet(ck);
	if (cached) return cached;
	const meta = await s3Service.getFileMetadata(key);
	await cacheSet(ck, meta, 600); // 10 minutes
	return meta;
}

module.exports = { getHeadCached };


