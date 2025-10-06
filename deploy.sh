#!/bin/bash

# Video Transcoding Platform - AWS Deployment Script
# Run this script on your local machine with AWS CLI configured

set -e

echo "Starting deployment of Video Transcoding Platform..."

# Configuration
REGION=${AWS_REGION:-ap-southeast-2}
ECR_REPO_NAME="video-transcoding-platform"
IMAGE_TAG="latest"
KEY_PAIR_NAME="video-transcoding-keypair"
SECURITY_GROUP_NAME="CAB432SG"
INSTANCE_TYPE="t3.medium"

# Required QUT tags (update with your student ID)
QUT_USERNAME="n11521775@qut.edu.au"
PURPOSE="assessment 1"

# Get AWS account ID
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
ECR_URI="${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com/${ECR_REPO_NAME}"

echo "Using configuration:"
echo "   Region: $REGION"
echo "   ECR URI: $ECR_URI"
echo "   Instance Type: $INSTANCE_TYPE"

# Step 1: Create ECR repository if it doesn't exist
echo "Creating ECR repository..."
aws ecr create-repository --repository-name $ECR_REPO_NAME --region $REGION 2>/dev/null || echo "Repository already exists"

# Step 2: Build and push Docker image
echo "Building Docker image..."
docker build -t $ECR_REPO_NAME .

echo "Logging in to ECR..."
aws ecr get-login-password --region $REGION | docker login --username AWS --password-stdin $ECR_URI

echo "Tagging image..."
docker tag $ECR_REPO_NAME:latest $ECR_URI:$IMAGE_TAG

echo "Pushing image to ECR..."
docker push $ECR_URI:$IMAGE_TAG

# Step 3: Create key pair if it doesn't exist
echo "Creating EC2 key pair..."
if ! aws ec2 describe-key-pairs --key-names $KEY_PAIR_NAME --region $REGION >/dev/null 2>&1; then
    aws ec2 create-key-pair --key-name $KEY_PAIR_NAME --region $REGION --query 'KeyMaterial' --output text > ${KEY_PAIR_NAME}.pem
    chmod 400 ${KEY_PAIR_NAME}.pem
    echo "Key pair created and saved as ${KEY_PAIR_NAME}.pem"
else
    echo "Key pair already exists"
fi

# Step 4: Use existing CAB432 security group
echo "Using CAB432 security group..."
SECURITY_GROUP_NAME="CAB432SG"
SECURITY_GROUP_ID="sg-032bd1ff8cf77dbb9"
echo "Using security group: $SECURITY_GROUP_ID"

# Step 4.5: Get current AWS credentials for user data
echo "Getting AWS credentials for EC2 instance..."
# Use environment variables if available, otherwise use config
if [ -n "$AWS_ACCESS_KEY_ID" ]; then
    USER_AWS_ACCESS_KEY_ID="$AWS_ACCESS_KEY_ID"
    USER_AWS_SECRET_ACCESS_KEY="$AWS_SECRET_ACCESS_KEY"
    USER_AWS_SESSION_TOKEN="$AWS_SESSION_TOKEN"
else
    USER_AWS_ACCESS_KEY_ID=$(aws configure get aws_access_key_id)
    USER_AWS_SECRET_ACCESS_KEY=$(aws configure get aws_secret_access_key)
    USER_AWS_SESSION_TOKEN=$(aws configure get aws_session_token)
fi

# Step 5: Create user data script
cat > user-data.sh << EOF
#!/bin/bash
apt-get update -y
apt-get install -y docker.io awscli unzip

systemctl start docker
systemctl enable docker
usermod -a -G docker ubuntu

# Configure AWS credentials
export AWS_ACCESS_KEY_ID=$USER_AWS_ACCESS_KEY_ID
export AWS_SECRET_ACCESS_KEY=$USER_AWS_SECRET_ACCESS_KEY
export AWS_SESSION_TOKEN=$USER_AWS_SESSION_TOKEN
export AWS_DEFAULT_REGION=$REGION

# Login to ECR and pull image
aws ecr get-login-password --region $REGION | docker login --username AWS --password-stdin $ECR_URI
docker pull $ECR_URI:$IMAGE_TAG

# Run the container
docker run -d \
    --name video-transcoding-app \
    -p 3000:3000 \
    --restart unless-stopped \
    $ECR_URI:$IMAGE_TAG

echo "Video transcoding platform deployed successfully!" > /var/log/deployment.log
EOF

# Step 6: Launch EC2 instance
echo "Launching EC2 instance..."
INSTANCE_ID=$(aws ec2 run-instances \
    --image-id ami-01361d3186814b895 \
    --count 1 \
    --instance-type $INSTANCE_TYPE \
    --key-name $KEY_PAIR_NAME \
    --security-group-ids $SECURITY_GROUP_ID \
    --subnet-id subnet-05d0352bb15852524 \
    --user-data file://user-data.sh \
    --region $REGION \
    --tag-specifications "ResourceType=instance,Tags=[{Key=Name,Value=video-transcoding-platform},{Key=qut-username,Value=$QUT_USERNAME},{Key=purpose,Value=$PURPOSE}]" \
    --query 'Instances[0].InstanceId' --output text)

echo "EC2 instance launched: $INSTANCE_ID"
echo "Waiting for instance to be running..."

aws ec2 wait instance-running --instance-ids $INSTANCE_ID --region $REGION

# Get public IP
PUBLIC_IP=$(aws ec2 describe-instances \
    --instance-ids $INSTANCE_ID \
    --region $REGION \
    --query 'Reservations[0].Instances[0].PublicIpAddress' --output text)

echo ""
echo "Deployment completed successfully!"
echo "Instance ID: $INSTANCE_ID"
echo "Public IP: $PUBLIC_IP"
echo "API URL: http://$PUBLIC_IP:3000"
echo "SSH command: ssh -i ${KEY_PAIR_NAME}.pem ec2-user@$PUBLIC_IP"
echo ""
echo "Please wait 2-3 minutes for the application to fully start."
echo "Test the API:"
echo "   Health check: curl http://$PUBLIC_IP:3000/health"
echo "   Login: curl -X POST http://$PUBLIC_IP:3000/auth/login -H 'Content-Type: application/json' -d '{\"username\":\"admin\",\"password\":\"admin123\"}'"

# Cleanup
rm -f user-data.sh

echo "Deployment script completed!"