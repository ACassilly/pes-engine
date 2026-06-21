#!/bin/bash
# PES Engine — Setup Script
# One-command setup for development environment

set -e

echo "========================================="
echo "PES Engine — Setup Script"
echo "Portlandia Electric Supply"
echo "========================================="

# Check Node.js version
NODE_VERSION=$(node -v 2>/dev/null | cut -d'v' -f2 | cut -d'.' -f1)
if [ -z "$NODE_VERSION" ] || [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Error: Node.js 18+ required. Current: $(node -v || echo 'not installed')"
    echo "   Install from: https://nodejs.org/"
    exit 1
fi

echo "✅ Node.js version: $(node -v)"

# Check npm version
NPM_VERSION=$(npm -v 2>/dev/null | cut -d'.' -f1)
if [ -z "$NPM_VERSION" ] || [ "$NPM_VERSION" -lt 9 ]; then
    echo "❌ Error: npm 9+ required. Current: $(npm -v || echo 'not installed')"
    exit 1
fi

echo "✅ npm version: $(npm -v)"

# Check for .env
if [ ! -f ".env" ]; then
    if [ -f ".env.example" ]; then
        echo "📋 Creating .env from .env.example..."
        cp .env.example .env
        echo "⚠️  Please edit .env with your Shopify credentials before continuing"
        read -p "Press Enter to continue after editing .env..."
    else
        echo "❌ Error: .env.example not found"
        exit 1
    fi
fi

# Create directories
echo "📁 Creating data directories..."
mkdir -p data/uploads
mkdir -p data/logs
mkdir -p data/backups
mkdir -p data/specs
mkdir -p data/exports

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Generate Prisma client
echo "🔧 Generating Prisma client..."
npm run db:generate

# Run migrations
echo "🗄️  Running database migrations..."
npm run db:migrate

# Seed database
echo "🌱 Seeding database with PES vendor data..."
npm run db:seed

# Build app
echo "🔨 Building application..."
npm run build

echo ""
echo "========================================="
echo "✅ Setup complete!"
echo "========================================="
echo ""
echo "Next steps:"
echo "1. Ensure your Shopify credentials are in .env"
echo "2. Start development server: npm run dev"
echo "3. Or start production: npm start"
echo "4. Or use Docker: docker compose up -d"
echo ""
echo "Admin dashboard: http://localhost:3000"
echo ""
