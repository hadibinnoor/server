# Video Transcoding Platform

A full-stack video transcoding platform with a modern React frontend and Node.js backend, deployed to AWS using Docker containers. This application demonstrates CPU-intensive processing, containerization, cloud deployment, and AWS Cognito authentication for the CAB432 Cloud Computing assignment.

## Features

### Core Functionality
- ✅ **CPU-intensive video transcoding** using FFmpeg (achieves 80%+ CPU load)
- ✅ **Modern React Frontend** with drag-and-drop upload and real-time monitoring
- ✅ **REST API** with full CRUD operations for transcoding jobs
- ✅ **AWS Cognito Authentication** with user registration, email confirmation, and JWT tokens
- ✅ **AWS S3 Integration** for scalable file storage and management
- ✅ **Dual data types**: Structured (SQLite job metadata) + Unstructured (S3 video files)
- ✅ **Docker containerization** with Ubuntu 22.04 base image
- ✅ **AWS deployment** via ECR and EC2
- ✅ **Load testing** script for performance validation

### Authentication Features
- 🔐 **User Registration** with username, email, and password validation
- 📧 **Email Confirmation** with verification codes sent to user's email
- 🔑 **Secure Login** using AWS Cognito with JWT token generation
- 👤 **User Management** integrated with existing job functionality
- 🛡️ **Protected Routes** with token-based authentication

### Frontend Features
- 🎨 **Modern UI** built with React, Tailwind CSS, and Lucide icons
- 📹 **Drag & Drop Upload** with file validation and format selection
- 📊 **Real-time Job Monitoring** with progress bars and status updates
- 🔐 **Secure Authentication** with Cognito integration and protected routes
- 📱 **Responsive Design** for desktop and mobile devices
- ⚡ **Fast Development** with Vite build tool

### API Endpoints
```
POST /auth/register           - User registration with email confirmation
POST /auth/confirm            - Email confirmation with verification code
POST /auth/login              - User authentication with JWT token
GET  /auth/user               - Get current user information
POST /jobs/upload-url         - Generate pre-signed URL for upload
POST /jobs/upload-complete    - Confirm upload and start transcoding
GET  /jobs                   - List all user's jobs with download URLs
GET  /jobs/:id               - Get specific job status with download URLs
POST /jobs/:id/download-url  - Generate fresh download URL
PUT  /jobs/:id               - Update job (retranscode)
DELETE /jobs/:id             - Delete job and files
GET  /health                 - Health check
```

## Quick Start

### Prerequisites
- Node.js 18+
- Docker
- AWS CLI configured
- AWS S3 bucket created
- AWS Cognito User Pool created
- FFmpeg (for local testing)

### Full Stack Development
```bash
# Start both backend and frontend servers
./start-dev.sh

# Or start individually:
# Backend only
npm run dev

# Frontend only
cd frontend && npm run dev
```

### Access the Application
- **Frontend UI**: http://localhost:5173
- **Backend API**: http://localhost:3000
- **Health Check**: http://localhost:3000/health

### Demo Credentials
- **Admin**: `admin` / `admin123`
- **User 1**: `user1` / `user123`
- **User 2**: `user2` / `user456`

### AWS S3 Configuration

Before running the application, you need to configure AWS S3:

1. **Create S3 Bucket**:
   ```bash
   aws s3 mb s3://your-video-transcoding-bucket --region ap-southeast-2
   ```

2. **Set Environment Variables**:
   Create a `.env` file in the server root:
   ```env
   AWS_REGION=ap-southeast-2
   AWS_ACCESS_KEY_ID=your-access-key
   AWS_SECRET_ACCESS_KEY=your-secret-key
   S3_BUCKET_NAME=your-video-transcoding-bucket
   JWT_SECRET=b7326cd06821a43a2a94ff9866f87908
   PORT=3000
   ```

3. **Detailed Setup**: See [S3_SETUP.md](S3_SETUP.md) for complete configuration guide.

### AWS Cognito Setup

1. **Create Cognito User Pool**:
   - Go to AWS Cognito Console
   - Create a new User Pool with email verification
   - Enable self-registration
   - Create an app client with USER_PASSWORD_AUTH flow

2. **Add Cognito Environment Variables**:
   Add these to your `.env` file:
   ```env
   COGNITO_USER_POOL_ID=ap-southeast-2_XXXXXXXXX
   COGNITO_CLIENT_ID=XXXXXXXXXXXXXXXXXXXXXXXXXX
   ```

3. **Detailed Setup**: See [COGNITO_SETUP.md](COGNITO_SETUP.md) for complete configuration guide.

### Pre-signed URL Workflow

The application uses AWS S3 pre-signed URLs for efficient file handling:

**Upload Process:**
1. Client requests upload URL from `/jobs/upload-url`
2. Server generates pre-signed PUT URL and returns it
3. Client uploads file directly to S3 using the pre-signed URL
4. Client confirms upload completion via `/jobs/upload-complete`
5. Server starts transcoding process

**Download Process:**
1. Server generates pre-signed GET URLs for file access
2. URLs expire after 1 hour for security
3. Client can request fresh URLs via `/jobs/:id/download-url`

**Benefits:**
- Reduced server load (files don't pass through EC2)
- Better performance and scalability
- Secure temporary access to private files
- Lower bandwidth costs

### Deploy to AWS
```bash
# Make deployment script executable
chmod +x deploy.sh

# Deploy to AWS (requires AWS CLI configured)
./deploy.sh
```

## Authentication

Default users (hardcoded):
- `admin` / `admin123`
- `user1` / `user123`  
- `user2` / `user456`

## Usage Example

```bash
# Login to get JWT token
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'

# Upload video for transcoding
curl -X POST http://localhost:3000/jobs/upload \
  -H "Authorization: Bearer JWT_TOKEN" \
  -F "video=@test-video.mp4" \
  -F "outputFormat=720p"

# Check job status
curl -X GET http://localhost:3000/jobs/JOB_ID \
  -H "Authorization: Bearer JWT_TOKEN"
```

## Architecture

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   Client    │───▶│  Express    │───▶│   FFmpeg    │
│             │    │   Server    │    │ Transcoder  │
└─────────────┘    └─────────────┘    └─────────────┘
                           │
                           ▼
                   ┌─────────────┐    ┌─────────────┐
                   │     RDS     │    │     S3      │
                   │ PostgreSQL  │    │   Storage   │
                   │ (Metadata)  │    │  (Files)    │
                   └─────────────┘    └─────────────┘
```

**Stateless Design**: The EC2 instance stores no persistent data locally. All data is stored in:
- **RDS PostgreSQL**: User accounts, job metadata, progress tracking
- **S3**: Original and transcoded video files
- **Temporary files**: Stored in `/tmp` and cleaned up after processing

## Data Types

1. **Structured Data (RDS PostgreSQL)**:
   - User accounts and authentication
   - Job metadata (status, progress, timestamps)
   - Video information (duration, size, format)
   - S3 URLs for file references

2. **Unstructured Data (AWS S3)**:
   - Original video files (stored in S3 bucket)
   - Transcoded video files (stored in S3 bucket)
   - Presigned URLs for secure file access

3. **Temporary Data (/tmp directory)**:
   - Temporary files during transcoding process
   - Automatically cleaned up after job completion or failure
   - No persistent storage on EC2 instance

## CPU-Intensive Processing

The application uses FFmpeg for video transcoding which:
- Consistently achieves 80-90% CPU utilization
- Processes videos for 5+ minutes depending on file size
- Supports multiple output formats (480p, 720p, 1080p)
- Real-time progress tracking

## Load Testing

Run the included load test to demonstrate CPU load:

```bash
npm test
```

The load test:
- Logs in with hardcoded credentials
- Uploads multiple test videos simultaneously
- Monitors transcoding progress in real-time
- Reports completion times and success rates

## Statelessness Verification

The application is designed to be completely stateless. To verify this:

1. **Create a job and upload a video**
2. **Stop/terminate the EC2 instance**
3. **Launch a new EC2 instance with the same configuration**
4. **Verify that all job data persists and is accessible**

### What Makes It Stateless:
- ✅ **No local database**: Uses RDS PostgreSQL instead of SQLite
- ✅ **No local file storage**: All files stored in S3
- ✅ **Temporary files in /tmp**: Automatically cleaned up
- ✅ **No persistent state**: Can be replaced without data loss

### Environment Variables Required:
```bash
# RDS Configuration (for statelessness)
RDS_HOSTNAME=your-rds-instance.region.rds.amazonaws.com
RDS_PORT=5432
RDS_DB_NAME=video_transcoding_db
RDS_USERNAME=your_db_username
RDS_PASSWORD=your_db_password
RDS_SSL=true

# S3 Configuration (already configured)
S3_BUCKET_NAME=your-s3-bucket-name
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_DEFAULT_REGION=ap-southeast-2
```

## Deployment Details

### Docker Container
- Based on Ubuntu 22.04
- Includes FFmpeg and Node.js 18
- Exposes port 3000
- Optimized for production use
- Stateless design - no persistent volumes required

### AWS Infrastructure
- **ECR**: Container registry for Docker images
- **RDS**: PostgreSQL database for metadata (required for statelessness)
- **S3**: Object storage for video files
- **EC2**: t3.medium instance for adequate CPU power
- **Security Groups**: Ports 22 (SSH) and 3000 (HTTP) open
- **Auto-deployment**: User data script handles container startup

## File Structure

```
├── server.js              # Main application entry point
├── routes/
│   ├── auth.js            # Authentication endpoints
│   └── jobs.js            # Job management endpoints
├── services/
│   └── transcoder.js      # FFmpeg transcoding service
├── database/
│   └── init.js            # SQLite database setup
├── middleware/
│   └── auth.js            # JWT authentication middleware
├── test/
│   └── load-test.js       # Load testing script
├── frontend/              # React frontend application
│   ├── src/
│   │   ├── components/    # React components
│   │   ├── contexts/      # React contexts (Auth)
│   │   ├── services/      # API service layer
│   │   └── App.jsx        # Main app component
│   ├── package.json       # Frontend dependencies
│   └── README.md          # Frontend documentation
├── Dockerfile             # Container configuration
├── deploy.sh              # AWS deployment script
├── start-dev.sh           # Development startup script
└── package.json           # Dependencies and scripts
```

## Performance Metrics

During testing, the application typically shows:
- **CPU Usage**: 80-95% during active transcoding
- **Memory Usage**: ~200-500MB depending on video size
- **Processing Time**: 2-10 minutes per video (varies by size/format)
- **Concurrent Jobs**: Supports multiple simultaneous transcoding tasks

## Assignment Compliance

This project fulfills all core requirements:
1. ✅ CPU-intensive process (video transcoding with FFmpeg)
2. ✅ Load testing method (automated test script)
3. ✅ Two data types (SQLite metadata + video files)
4. ✅ Containerization (Docker with Ubuntu 22.04)
5. ✅ AWS deployment (ECR + EC2)
6. ✅ REST API (full CRUD operations)
7. ✅ JWT authentication (hardcoded users)

## Troubleshooting

### Common Issues
1. **FFmpeg not found**: Ensure FFmpeg is installed in the container
2. **Permission denied**: Check file upload directory permissions
3. **AWS deployment fails**: Verify AWS CLI configuration and permissions
4. **High CPU usage**: This is expected during video transcoding
5. **Long processing times**: Normal for large video files

### Monitoring
- Check `/health` endpoint for service status
- Monitor EC2 instance CPU usage in AWS CloudWatch
- Review application logs via `docker logs video-transcoding-app`

aws ec2 start-instances --instance-ids i-007f698a20f2a7dd6 --region ap-southeast-2

aws ec2 describe-instances --instance-ids i-007f698a20f2a7dd6 --region ap-southeast-2 --query 'Reservations[0].Instances[0].PublicIpAddress' --output text