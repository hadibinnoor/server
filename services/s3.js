const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const path = require('path');
const configLoader = require('./configLoader');

class S3Service {
	constructor() {
		this.bucketName = process.env.S3_BUCKET_NAME;
		this.region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'ap-southeast-2';
		this.s3Client = null;
		this.isConfigured = false;
		this.initPromise = null;
	}

	async initIfNeeded() {
		if (this.isConfigured) return true;
		if (this.initPromise) return this.initPromise;

		this.initPromise = (async () => {
			// Prefer env, else fetch from Parameter Store
			if (!this.bucketName) {
				this.bucketName = await configLoader.getAsync('S3_BUCKET_NAME', { ssmName: '/app/S3_BUCKET_NAME' });
			}
			if (!this.region) {
				const region = await configLoader.getAsync('AWS_DEFAULT_REGION', { ssmName: '/app/AWS_DEFAULT_REGION' });
				if (region) this.region = region;
			}

			if (this.bucketName && (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY || process.env.AWS_CONTAINER_CREDENTIALS_FULL_URI || process.env.AWS_ROLE_ARN || process.env.AWS_EXECUTION_ENV)) {
				const clientConfig = { region: this.region };
				// If static creds present, set them; otherwise rely on default provider/instance role
				if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
					clientConfig.credentials = {
						accessKeyId: process.env.AWS_ACCESS_KEY_ID,
						secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
					};
					if (process.env.AWS_SESSION_TOKEN) {
						clientConfig.credentials.sessionToken = process.env.AWS_SESSION_TOKEN;
					}
				}

				this.s3Client = new S3Client(clientConfig);
				this.isConfigured = true;
				console.log('S3 service configured');
				console.log(`Bucket: ${this.bucketName}, Region: ${this.region}`);
			} else {
				this.s3Client = null;
				this.isConfigured = false;
				console.log('S3 service not configured - set S3_BUCKET_NAME and AWS credentials/role');
			}
			return this.isConfigured;
		})();

		return this.initPromise;
	}

	// Check if S3 is properly configured
	async isS3Configured() {
		await this.initIfNeeded();
		return this.isConfigured;
	}

	// Throw error if S3 is not configured
	async ensureConfigured() {
		const ok = await this.initIfNeeded();
		if (!ok) {
			throw new Error('S3 service is not configured. Please set S3_BUCKET_NAME or store it in Parameter Store, and provide AWS credentials/role.');
		}
	}

	async uploadFile(fileBuffer, key, contentType) {
		await this.ensureConfigured();
		try {
			const command = new PutObjectCommand({
				Bucket: this.bucketName,
				Key: key,
				Body: fileBuffer,
				ContentType: contentType,
				ACL: 'private',
			});
			await this.s3Client.send(command);
			return `s3://${this.bucketName}/${key}`;
		} catch (error) {
			console.error('S3 upload error:', error);
			throw new Error(`Failed to upload file to S3: ${error.message}`);
		}
	}

	async getSignedDownloadUrl(key, expiresIn = 3600) {
		await this.ensureConfigured();
		try {
			const command = new GetObjectCommand({ Bucket: this.bucketName, Key: key });
			return await getSignedUrl(this.s3Client, command, { expiresIn });
		} catch (error) {
			console.error('S3 presigned URL error:', error);
			throw new Error(`Failed to generate download URL: ${error.message}`);
		}
	}

	async getSignedUploadUrl(key, contentType, expiresIn = 3600) {
		await this.ensureConfigured();
		try {
			const command = new PutObjectCommand({ 
				Bucket: this.bucketName, 
				Key: key, 
				ContentType: contentType,
				// Ensure the object is private (no public access needed)
				ACL: 'private'
			});
			
			// Generate URL with proper signing
			const url = await getSignedUrl(this.s3Client, command, { 
				expiresIn,
				// Ensure all required headers are signed
				signableHeaders: new Set(['content-type'])
			});
			
			console.log('Generated pre-signed URL for upload:', key);
			return url;
		} catch (error) {
			console.error('S3 presigned upload URL error:', error);
			throw new Error(`Failed to generate upload URL: ${error.message}`);
		}
	}

	async deleteFile(key) {
		await this.ensureConfigured();
		try {
			const command = new DeleteObjectCommand({ Bucket: this.bucketName, Key: key });
			await this.s3Client.send(command);
		} catch (error) {
			console.error('S3 delete error:', error);
			throw new Error(`Failed to delete file from S3: ${error.message}`);
		}
	}

	async fileExists(key) {
		await this.ensureConfigured();
		try {
			const command = new HeadObjectCommand({ Bucket: this.bucketName, Key: key });
			await this.s3Client.send(command);
			return true;
		} catch (error) {
			if (error.name === 'NotFound') return false;
			throw error;
		}
	}

	generateKey(originalFilename, prefix = 'videos') {
		const timestamp = Date.now();
		const randomId = Math.random().toString(36).substring(2, 15);
		const extension = path.extname(originalFilename);
		const filename = path.basename(originalFilename, extension);
		return `${prefix}/${timestamp}-${randomId}-${filename}${extension}`;
	}

	extractKeyFromUrl(s3Url) {
		if (!s3Url.startsWith('s3://')) throw new Error('Invalid S3 URL format');
		const urlParts = s3Url.replace('s3://', '').split('/');
		if (urlParts.length < 2) throw new Error('Invalid S3 URL format');
		return urlParts.slice(1).join('/');
	}

	async getFileMetadata(key) {
		await this.ensureConfigured();
		try {
			const command = new HeadObjectCommand({ Bucket: this.bucketName, Key: key });
			const response = await this.s3Client.send(command);
			return {
				size: response.ContentLength,
				lastModified: response.LastModified,
				contentType: response.ContentType,
				etag: response.ETag,
			};
		} catch (error) {
			console.error('S3 metadata error:', error);
			throw new Error(`Failed to get file metadata: ${error.message}`);
		}
	}
}

module.exports = new S3Service();
