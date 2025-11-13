#!/bin/sh
set -e

APP_NAME=${APP_NAME:-"unknown"}
echo "=========================================="
echo " Starting $APP_NAME"
echo "=========================================="

# Run migrations if app name is set
if [ "$APP_NAME" != "unknown" ]; then
  echo ""
  echo " Running Prisma migrations for $APP_NAME..."
  echo "Database: $DATABASE_URL_USER$DATABASE_URL_PRODUCT$DATABASE_URL_ORDER$DATABASE_URL_CART$DATABASE_URL_PAYMENT$DATABASE_URL_REPORT$DATABASE_URL_AR"
  
  npx prisma migrate deploy --schema=apps/${APP_NAME}/prisma/schema.prisma 2>&1 || {
    echo "⚠️  Warning: Migration may have failed or already applied"
  }
  
  echo " Migrations completed"
  echo ""
  
  # Generate JWT keys for user-app only
  if [ "$APP_NAME" = "user-app" ]; then
    echo "🔐 Generating JWT keys for user-app..."
    mkdir -p /app/keys
    
    # Check if keys already exist
    if [ -f "/app/keys/private-key.pem" ] && [ -f "/app/keys/public-key.pem" ]; then
      echo " Keys already exist, skipping generation"
    else
      # Generate keys using the generate-keys script
      node dist/scripts/generate-keys.js 2>&1 || {
        echo "⚠️  Warning: Failed to generate keys"
      }
      echo " Keys generated"
    fi
    echo ""
  fi
fi

# Start application
echo "=========================================="
echo "▶️  Starting application..."
echo "=========================================="
node dist/apps/${APP_NAME}/main.js

