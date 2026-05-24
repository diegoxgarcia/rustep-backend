#!/bin/bash

echo "=========================================="
echo "Rustep Backend Setup Script"
echo "=========================================="
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "Error: Node.js is not installed. Please install Node.js 18 or higher."
    exit 1
fi

echo "Node.js version: $(node -v)"
echo ""

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "Error: npm is not installed."
    exit 1
fi

echo "npm version: $(npm -v)"
echo ""

# Install dependencies
echo "Installing dependencies..."
npm install

if [ $? -ne 0 ]; then
    echo "Error: Failed to install dependencies."
    exit 1
fi

echo ""
echo "Dependencies installed successfully!"
echo ""

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo "Creating .env file from .env.example..."
    cp .env.example .env
    echo ".env file created. Please update it with your configuration."
else
    echo ".env file already exists."
fi

echo ""

# Generate Prisma client
echo "Generating Prisma client..."
npm run prisma:generate

if [ $? -ne 0 ]; then
    echo "Error: Failed to generate Prisma client."
    exit 1
fi

echo ""
echo "Prisma client generated successfully!"
echo ""

# Create logs directory
if [ ! -d "logs" ]; then
    mkdir logs
    echo "Created logs directory."
fi

echo ""
echo "=========================================="
echo "Setup completed successfully!"
echo "=========================================="
echo ""
echo "Next steps:"
echo "1. Update .env file with your database credentials"
echo "2. Start MongoDB and PostgreSQL"
echo "3. Run 'npm run prisma:migrate' to create database tables"
echo "4. Run 'npm run seed' to populate sample data (optional)"
echo "5. Run 'npm run dev' to start the development server"
echo ""
