#!/bin/bash
set -e

# Push script for all Docker images to registry
# Usage: ./scripts/push-all-images.sh
# Prerequisites: docker login already performed
# Environment variables:
#   DOCKER_USERNAME: Docker registry username (default: yourusername)
#   VERSION: Image version tag (default: latest)

REGISTRY_USER=${DOCKER_USERNAME:-"haongo123"}
VERSION=${VERSION:-"latest"}

echo "=================================="
echo " Pushing all Docker images"
echo "=================================="
echo "Registry: $REGISTRY_USER"
echo "Version: $VERSION"
echo ""

# Check if logged in
if ! docker info | grep -q "Username"; then
  echo " Not logged in to Docker registry"
  echo "   Run: docker login"
  exit 1
fi

# Push gateway
echo "⬆️  Pushing gateway..."
docker push $REGISTRY_USER/lv-gateway:$VERSION

if [ $? -ne 0 ]; then
  echo " Failed to push gateway"
  exit 1
fi
echo " Gateway pushed successfully"
echo ""

# Push microservices
all_apps=("user-app" "product-app" "order-app" "cart-app" "payment-app" "report-app" "ar-app")

for app in "${all_apps[@]}"; do
  echo "⬆️  Pushing $app..."
  docker push $REGISTRY_USER/lv-$app:$VERSION
  
  if [ $? -ne 0 ]; then
    echo " Failed to push $app"
    exit 1
  fi
  echo " $app pushed successfully"
  echo ""
done

echo "=================================="
echo " All images pushed successfully!"
echo "=================================="
echo ""
echo " Images available at Docker Hub:"
echo "  docker pull $REGISTRY_USER/lv-gateway:$VERSION"
echo "  docker pull $REGISTRY_USER/lv-user-app:$VERSION"
echo "  docker pull $REGISTRY_USER/lv-product-app:$VERSION"
echo "  docker pull $REGISTRY_USER/lv-order-app:$VERSION"
echo "  docker pull $REGISTRY_USER/lv-cart-app:$VERSION"
echo "  docker pull $REGISTRY_USER/lv-payment-app:$VERSION"
echo "  docker pull $REGISTRY_USER/lv-report-app:$VERSION"
echo "  docker pull $REGISTRY_USER/lv-ar-app:$VERSION"

