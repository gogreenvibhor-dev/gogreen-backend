#!/bin/bash
# RDS Database Setup Script for GoGreen

echo "🔧 Setting up AWS RDS database..."
echo ""

cd /home/khushwantsingh/code/mskard/gogreen/backend

# Step 1: Verify tables exist (they should from drizzle-kit push)
echo "1️⃣ Verifying database schema..."
pnpm db:push
echo ""

# Step 2: Seed the database with initial data
echo "2️⃣ Seeding database with initial data..."
pnpm db:seed
echo ""

# Step 3: Seed default settings
echo "3️⃣ Seeding default settings..."
tsx seed_default_settings.ts
echo ""

# Step 4: Start the server
echo "4️⃣ Starting backend server..."
echo "✅ Ready! Starting server with RDS connection..."
pnpm dev
