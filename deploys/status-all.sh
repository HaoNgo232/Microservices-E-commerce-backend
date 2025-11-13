#!/bin/bash

# Check status of all deployed services
# Usage: ./status-all.sh

echo "=========================================="
echo "��� Checking all service status"
echo "=========================================="
echo ""

apps=(gateway user-app product-app order-app cart-app payment-app report-app ar-app)

running_count=0
total_count=${#apps[@]}

for app in "${apps[@]}"; do
  if [ -f "${app}.yml" ]; then
    # Get container status
    status=$(docker compose -f ${app}.yml ps --format json 2>/dev/null | grep -o '"State":"[^"]*"' | cut -d'"' -f4 || echo "not found")
    
    # Get container ID
    container_id=$(docker compose -f ${app}.yml ps -q 2>/dev/null | head -1 || echo "none")
    
    # Count running
    if [ "$status" = "running" ]; then
      running_count=$((running_count + 1))
      status_icon=""
    else
      status_icon=""
    fi
    
    printf "%-15s %s %-10s" "$app:" "$status_icon" "$status"
    
    if [ "$status" = "running" ]; then
      printf " (ID: %.12s)\n" "$container_id"
    else
      echo ""
    fi
  else
    echo "$app:              ⚠️  compose file not found"
  fi
done

echo ""
echo "=========================================="
echo "Summary: $running_count/$total_count services running"
echo "=========================================="
echo ""

if [ $running_count -eq $total_count ]; then
  echo " All services operational!"
  
  # Try to get basic info
  echo ""
  echo "Gateway health check:"
  curl -s http://localhost:3000/health || echo "⚠️  Gateway not responding on localhost:3000"
  
  exit 0
else
  echo "⚠️  Some services are not running"
  exit 1
fi
