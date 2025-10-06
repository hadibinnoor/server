Assignment 2 - Cloud Services Exercises - Response to Criteria
================================================

Instructions
------------------------------------------------
- Keep this file named A2_response_to_criteria.md, do not change the name
- Upload this file along with your code in the root directory of your project
- Upload this file in the current Markdown format (.md extension)
- Do not delete or rearrange sections.  If you did not attempt a criterion, leave it blank
- Text inside [ ] like [eg. S3 ] are examples and should be removed


Overview
------------------------------------------------

- **Name:** 
- **Student number:** n11521775
- **Partner name (if applicable):** 
- **Application name:** Video Transcoding Platform
- **Two line description:** A full-stack video transcoding platform with React frontend and Node.js backend that processes videos using FFmpeg and stores them in AWS S3 with PostgreSQL metadata storage.
- **EC2 instance name or ID:**  i-05efde0ed1128495e

------------------------------------------------

### Core - First data persistence service

- **AWS service name:** S3
- **What data is being stored?:** Original and transcoded video files (MP4, AVI, MOV, MKV, WebM formats)
- **Why is this service suited to this data?:** Video files are large binary objects that require scalable storage with high availability. S3 provides unlimited storage capacity, 99.99% durability, and global accessibility for video content delivery.
- **Why is are the other services used not suitable for this data?:** RDS has file size limitations and is designed for structured data. DynamoDB has item size limits (400KB) which are insufficient for video files. EBS/EFS are block/file storage attached to specific instances, making them unsuitable for stateless applications.
- **Bucket/instance/table name:** n11521775-bucket
- **Video timestamp:** 00:00
- **Relevant files:**
    - services/s3.js
    - routes/jobs.js (upload-url, upload-complete endpoints)
    - frontend/src/components/VideoUpload.jsx

### Core - Second data persistence service

- **AWS service name:** RDS PostgreSQL
- **What data is being stored?:** User accounts, job metadata, video information (duration, size, format), S3 URLs, progress tracking, timestamps
- **Why is this service suited to this data?:** Structured relational data requires ACID transactions, complex queries, and referential integrity. PostgreSQL provides advanced querying capabilities for job filtering, user management, and reporting features.
- **Why is are the other services used not suitable for this data?:** S3 is object storage unsuitable for structured queries. DynamoDB lacks complex querying capabilities and relational features needed for user-job relationships and metadata queries.
- **Bucket/instance/table name:** database-1-instance-1.ce2haupt2cta.ap-southeast-2.rds.amazonaws.com
- **Video timestamp:** 00:50
- **Relevant files:**
    - database/rds.js
    - database/init.js
    - database/adapter.js
    - routes/jobs.js (job management endpoints)

### Third data service

- **AWS service name:** ElastiCache Memcached
- **What data is being stored?:** Cached job lists, download URLs, and frequently accessed metadata to reduce database load
- **Why is this service suited to this data?:** Job lists and download URLs are accessed frequently by users checking their transcoding progress. Memcached provides fast in-memory caching to reduce RDS load and improve response times.
- **Why is are the other services used not suitable for this data?:** S3 and RDS are persistent storage services, not caching layers. Temporary cached data needs fast access and automatic expiration, which Memcached provides efficiently.
- **Bucket/instance/table name:** a2-n11521775.km2jzi.cfg.apse2.cache.amazonaws.com:11211
- **Video timestamp:** 
- **Relevant files:**
    - services/cache.js
    - routes/jobs.js (caching implementation)

### S3 Pre-signed URLs

- **S3 Bucket names:** n11521775-bucket
- **Video timestamp:** 01:26
- **Relevant files:**
    - services/s3.js (getSignedUploadUrl, getSignedDownloadUrl methods)
    - routes/jobs.js (upload-url, download-url endpoints)
    - frontend/src/components/VideoUpload.jsx (upload workflow)
    - frontend/src/components/JobsDashboard.jsx (download functionality)

### In-memory cache

- **ElastiCache instance name:** a2-n11521775.km2jzi.cfg.apse2.cache.amazonaws.com:11211
- **What data is being cached?:** Job lists, download URLs, and user-specific transcoding job metadata
- **Why is this data likely to be accessed frequently?:** Users frequently check their transcoding job status and download completed videos. Caching reduces database load and improves response times for popular job queries and download URL generation.
- **Video timestamp:** 02:03
- **Relevant files:**
    - services/cache.js
    - routes/jobs.js (cacheGet, cacheSet, cacheDel usage)

### Core - Statelessness

- **What data is stored within your application that is not stored in cloud data services?:** Temporary video files during transcoding process stored in /tmp directory
- **Why is this data not considered persistent state?:** Temporary files are intermediate processing artifacts that can be recreated from the original S3 source files if lost. They are automatically cleaned up after transcoding completion or failure.
- **How does your application ensure data consistency if the app suddenly stops?:** Job status is tracked in RDS database with atomic updates. If transcoding fails, the job status is marked as 'failed' and temporary files are cleaned up. The application can resume or retry transcoding from the original S3 source files.
- **Relevant files:**
    - services/transcoder.js
    - database/init.js (job status tracking)
    - routes/jobs.js (status management)

### Graceful handling of persistent connections

- **Type of persistent connection and use:** Real-time job progress monitoring using polling mechanism
- **Method for handling lost connections:** Client-side polling with exponential backoff retry logic. If connection is lost, the frontend displays connection status and automatically reconnects when available.
- **Relevant files:**
    - frontend/src/components/JobsDashboard.jsx (polling implementation)
    - frontend/src/services/api.js (error handling and retry logic)


### Core - Authentication with Cognito

- **User pool name:** ap-southeast-2_DTNZcMnCA
- **How are authentication tokens handled by the client?:** JWT tokens (access, ID, refresh) are stored in localStorage and automatically included in API requests via axios interceptors. Tokens are verified server-side using Cognito JWKS.
- **Video timestamp:** 03:03
- **Relevant files:**
    - services/cognito.js
    - services/jwtVerifier.js
    - middleware/auth.js
    - frontend/src/contexts/AuthContext.jsx
    - frontend/src/services/api.js

### Cognito multi-factor authentication

- **What factors are used for authentication:** Password + Software Token MFA (TOTP) using authenticator apps like Google Authenticator or Authy
- **Video timestamp:** 04:41
- **Relevant files:**
    - services/cognito.js (AssociateSoftwareTokenCommand, VerifySoftwareTokenCommand, SetUserMFAPreferenceCommand)
    - routes/mfa.js
    - frontend/src/components/MFASetup.jsx
    - frontend/src/components/MFAChallenge.jsx



### Cognito groups

- **How are groups used to set permissions?:** 'Admins' group members have access to admin-only endpoints like GET /jobs/all to view all users' transcoding jobs. Regular users can only access their own jobs.
- **Video timestamp:** 05:39
- **Relevant files:**
    - middleware/auth.js (isAdmin middleware)
    - services/cognito.js (getUserGroups method)
    - routes/jobs.js (admin-only /all endpoint)
    - frontend/src/components/AdminJobs.jsx

### Core - DNS with Route53

- **Subdomain**: n11521775.cab432.com
- **Video timestamp:** 6:34

### Parameter store

- **Parameter names:** /app/MEMCACHED_ENDPOINT, /app/COGNITO_USER_POOL_ID, /app/COGNITO_CLIENT_ID, /app/COGNITO_CLIENT_SECRET, /app/AWS_DEFAULT_REGION
- **Video timestamp:** [To be provided during demonstration]
- **Relevant files:**
    - services/configLoader.js
    - services/cache.js (MEMCACHED_ENDPOINT)
    - services/cognito.js (Cognito configuration)

### Secrets manager

- **Secrets names:** Not implemented (using Parameter Store with encryption instead)
- **Video timestamp:**
- **Relevant files:**


### Infrastructure as code

- **Technology used:** Terraform (HashiCorp)
- **Services deployed:** VPC with public/private subnets, S3 bucket, RDS PostgreSQL, Cognito User Pool, ElastiCache Memcached, Parameter Store, IAM roles and policies, Security Groups
- **Video timestamp:** [To be provided during demonstration]
- **Relevant files:**
    - terraform/main.tf (provider configuration and data sources)
    - terraform/variables.tf (input variables and validation)
    - terraform/vpc.tf (VPC, subnets, routing, NAT Gateway)
    - terraform/s3.tf (S3 bucket with CORS, encryption, lifecycle policies)
    - terraform/rds.tf (PostgreSQL database with private subnet deployment)
    - terraform/cognito.tf (User Pool with MFA, App Client configuration)
    - terraform/elasticache.tf (Memcached cluster configuration)
    - terraform/iam.tf (EC2 instance role with S3, Parameter Store, Cognito permissions)
    - terraform/ssm.tf (Parameter Store parameters for configuration management)
    - terraform/outputs.tf (infrastructure outputs and application configuration)
    - terraform/user-data.sh (EC2 initialization script)

### Other (with prior approval only)

- **Description:**
- **Video timestamp:**
- **Relevant files:**
    -

### Other (with prior permission only)

- **Description:**
- **Video timestamp:**
- **Relevant files:**

