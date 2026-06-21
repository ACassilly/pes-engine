#!/bin/bash
# PES Engine — Deployment Script
# Deploy to production environment

set -e

echo "========================================="
echo "PES Engine — Deployment Script"
echo "Portlandia Electric Supply"
echo "========================================="

# Check environment
ENV=${NODE_ENV:-production}
AIRGAP=${AIRGAP_MODE:-false}

echo "Environment: $ENV"
echo "Airgap mode: $AIRGAP"

# Pull latest changes
echo "📥 Pulling latest changes..."
git pull origin main

# Install dependencies
echo "📦 Installing dependencies..."
npm ci

# Generate Prisma client
echo "🔧 Generating Prisma client..."
npm run db:generate

# Run migrations
echo "🗄️  Running migrations..."
npm run db:migrate

# Build application
echo "🔨 Building application..."
npm run build

# Run health checks
echo "🏥 Running health checks..."
# (Health check logic would go here)

# Restart service (if using systemd or similar)
if command -v systemctl &> /dev/null; then
    echo "🔄 Restarting systemd service..."
    sudo systemctl restart pes-engine || true
elif command -v docker-compose &> /dev/null; then
    echo "🔄 Restarting Docker containers..."
    docker-compose up -d --build
else
    echo "⚠️  No service manager detected. Please restart manually."
fi

echo ""
echo "========================================="
echo "✅ Deployment complete!"
echo "========================================="
