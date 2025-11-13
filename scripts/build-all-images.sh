#!/bin/bash
set -e

# Build script for all Docker images
# Usage: ./scripts/build-all-images.sh
# Environment variables:
#   DOCKER_USERNAME: Docker registry username (default: yourusername)
#   VERSION: Image version tag (default: latest)

REGISTRY_USER=${DOCKER_USERNAME:-"yourusername"}
VERSION=${VERSION:-"latest"}

echo "=================================="
echo " Building all Docker images"
echo "=================================="
echo "Registry: $REGISTRY_USER"
echo "Version: $VERSION"
echo ""

# Build gateway
echo " Building gateway..."
docker build \
  -t $REGISTRY_USER/lv-gateway:$VERSION \
  -f Dockerfile.gateway \
  .

if [ $? -ne 0 ]; then
  echo " Failed to build gateway"
  exit 1
fi
echo " Gateway built successfully"
echo ""

# Build microservices
apps=("user-app" "product-app" "order-app" "cart-app" "payment-app" "report-app" "ar-app")

for app in "${apps[@]}"; do
  echo " Building $app..."
  docker build \
    -t $REGISTRY_USER/lv-$app:$VERSION \
    -f Dockerfile.$app \
    .
  
  if [ $? -ne 0 ]; then
    echo " Failed to build $app"
    exit 1
  fi
  echo " $app built successfully"
  echo ""
done

echo "=================================="
echo " All images built successfully!"
echo "=================================="
echo ""
echo " Built images:"
docker images | grep "lv-" | grep "$VERSION"
echo ""
echo " Next step: ./scripts/push-all-images.sh"

