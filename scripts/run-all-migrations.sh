#!/bin/bash
set -e

# Run Prisma migrations for all microservices
# This script should be run from the project root (backend-luan-van)
#
# Usage:
#   ./scripts/run-all-migrations.sh
#
# Environment variables (from .env file):
#   DATABASE_URL_USER
#   DATABASE_URL_PRODUCT
#   DATABASE_URL_ORDER
#   DATABASE_URL_CART
#   DATABASE_URL_PAYMENT
#   DATABASE_URL_REPORT
#   DATABASE_URL_AR

echo "=================================="
echo " Running all migrations"
echo "=================================="
echo ""

apps=("user-app" "product-app" "order-app" "cart-app" "payment-app" "report-app" "ar-app")

failed_apps=()
successful_apps=()

for app in "${apps[@]}"; do
  echo "Running migrations for $app..."
  
  if npx prisma migrate deploy --schema=apps/${app}/prisma/schema.prisma 2>&1; then
    echo " $app migrations completed"
    successful_apps+=("$app")
  else
    echo " $app migrations failed"
    failed_apps+=("$app")
  fi
  echo ""
done

echo "=================================="
echo "📊 Migration Summary"
echo "=================================="
echo " Successful: ${#successful_apps[@]}"
for app in "${successful_apps[@]}"; do
  echo "   - $app"
done

if [ ${#failed_apps[@]} -gt 0 ]; then
  echo ""
  echo " Failed: ${#failed_apps[@]}"
  for app in "${failed_apps[@]}"; do
    echo "   - $app"
  done
  echo ""
  echo "  Some migrations failed. Check logs above."
  exit 1
else
  echo ""
  echo " All migrations completed successfully!"
  exit 0
fi

