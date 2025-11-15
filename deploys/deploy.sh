#!/bin/bash
set -e

# Deploy script for individual microservice
# Usage: ./deploy.sh <app-name>
# Example: ./deploy.sh user-app

APP_NAME=$1

# Validate input
if [ -z "$APP_NAME" ]; then
  echo "Usage: ./deploy.sh <app-name>"
  echo ""
  echo "Available apps:"
  echo "  - gateway"
  echo "  - user-app"
  echo "  - product-app"
  echo "  - order-app"
  echo "  - cart-app"
  echo "  - payment-app"
  echo "  - report-app"
  echo "  - ar-app"
  exit 1
fi

# Check if compose file exists
if [ ! -f "${APP_NAME}.yml" ]; then
  echo " Error: ${APP_NAME}.yml not found"
  echo "Make sure you're in the deploys/ directory"
  exit 1
fi

# Check if .env exists
if [ ! -f ".env" ]; then
  echo " Error: .env file not found"
  echo "Please create .env from .env.example:"
  echo "  cp .env.example .env"
  echo "  nano .env"
  exit 1
fi

# Load environment
set -a
source .env
set +a

echo "=========================================="
echo "��� Deploying: $APP_NAME"
echo "=========================================="
echo "Registry: ${DOCKER_USERNAME}"
echo "Version: ${VERSION:-latest}"
echo "NATS URL: ${NATS_URL}"
echo ""

# Pull latest image
echo "��� Pulling image..."
docker compose -f ${APP_NAME}.yml pull

if [ $? -ne 0 ]; then
  echo " Failed to pull image"
  echo "Make sure:"
  echo "  1. Docker is running"
  echo "  2. Image exists: ${DOCKER_USERNAME}/lv-${APP_NAME}:${VERSION:-latest}"
  echo "  3. You're logged in: docker login"
  exit 1
fi

echo " Image pulled"
echo ""

# Stop existing container if running
echo "��� Stopping existing container (if any)..."
docker compose -f ${APP_NAME}.yml stop || true

# Start container
echo "▶️  Starting container..."
docker compose -f ${APP_NAME}.yml up -d

if [ $? -ne 0 ]; then
  echo " Failed to start container"
  exit 1
fi

echo " Container started"
echo ""

# Wait for container to be ready
echo "⏳ Waiting for container to be ready..."
sleep 3

# Check status
STATUS=$(docker compose -f ${APP_NAME}.yml ps --format json | grep -o '"State":"[^"]*"' | cut -d'"' -f4 || echo "unknown")

echo "=========================================="
if [ "$STATUS" = "running" ]; then
  echo " $APP_NAME deployed successfully!"
  echo "Status: $STATUS"
else
  echo "  $APP_NAME status: $STATUS"
fi
echo "=========================================="
echo ""

# Show logs
echo "��� Recent logs (Ctrl+C to exit):"
echo "Command: docker compose -f ${APP_NAME}.yml logs -f"
echo ""
docker compose -f ${APP_NAME}.yml logs -f
