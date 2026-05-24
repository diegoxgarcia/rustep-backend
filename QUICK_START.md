# Rustep Backend - Quick Start Guide

This guide will help you get the Rustep backend up and running quickly.

## Prerequisites

- **Node.js** >= 18.0.0
- **npm** >= 9.0.0
- **MongoDB** >= 6.0
- **PostgreSQL** >= 14.0

## Quick Setup (5 minutes)

### Option 1: Using Docker (Recommended)

1. Make sure Docker and Docker Compose are installed

2. Start all services:
```bash
docker-compose up -d
```

3. Run database migrations:
```bash
docker-compose exec api npm run prisma:migrate
```

4. Seed sample data:
```bash
docker-compose exec api npm run seed
```

5. Done! API is running at `http://localhost:3000`

### Option 2: Manual Setup

1. Install dependencies:
```bash
npm install
```

2. Copy environment file:
```bash
cp .env.example .env
```

3. Edit `.env` with your database credentials

4. Generate Prisma client:
```bash
npm run prisma:generate
```

5. Run database migrations:
```bash
npm run prisma:migrate
```

6. Start MongoDB and PostgreSQL (locally or via Docker)

7. Start the server:
```bash
npm run dev
```

## Testing the API

### Health Check

```bash
curl http://localhost:3000/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2024-05-24T...",
  "uptime": 123.456,
  "environment": "development"
}
```

### Google Sign-In (Example)

```bash
curl -X POST http://localhost:3000/api/v1/auth/google \
  -H "Content-Type: application/json" \
  -d '{"idToken": "YOUR_GOOGLE_ID_TOKEN"}'
```

### Submit Steps (Authenticated)

```bash
curl -X POST http://localhost:3000/api/v1/steps \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "stepsCount": 5000,
    "startTime": "2024-05-24T10:00:00Z",
    "endTime": "2024-05-24T10:45:00Z",
    "gpsVarianceMeters": 250,
    "avgSpeedKmh": 8.5,
    "stepsDistribution": [
      {"minute": 1, "steps": 110},
      {"minute": 2, "steps": 115}
    ]
  }'
```

### Get Stamina Balance

```bash
curl http://localhost:3000/api/v1/stamina/balance \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Get Rankings

```bash
curl http://localhost:3000/api/v1/rankings/weekly/WEEKLY_STEPS \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## Project Structure Overview

```
rustep-backend/
├── src/
│   ├── modules/         # Feature modules (auth, users, steps, etc)
│   ├── config/          # Configuration files
│   ├── middleware/      # Express middleware
│   └── utils/           # Utility functions
├── models/              # MongoDB models
├── prisma/              # PostgreSQL schema and migrations
└── scripts/             # Utility scripts
```

## Common Commands

```bash
# Development
npm run dev              # Start dev server with auto-reload

# Database
npm run prisma:generate  # Generate Prisma client
npm run prisma:migrate   # Run migrations
npm run prisma:studio    # Open Prisma Studio GUI
npm run seed             # Seed sample data

# Production
npm start                # Start production server

# Testing
npm test                 # Run tests
npm run lint             # Run linter
```

## Environment Variables

Key variables to configure in `.env`:

```env
# Server
PORT=3000
NODE_ENV=development

# MongoDB
MONGODB_URI=mongodb://localhost:27017/rustep

# PostgreSQL
DATABASE_URL=postgresql://user:password@localhost:5432/rustep_postgres

# JWT
JWT_SECRET=your-secret-key

# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-secret
```

## Troubleshooting

### MongoDB Connection Error

- Make sure MongoDB is running: `mongosh --eval "db.version()"`
- Check connection string in `.env`

### PostgreSQL Connection Error

- Make sure PostgreSQL is running: `psql --version`
- Verify DATABASE_URL in `.env`
- Run migrations: `npm run prisma:migrate`

### Prisma Client Not Found

- Run: `npm run prisma:generate`

### Port Already in Use

- Change PORT in `.env` or stop the process using port 3000

## Next Steps

1. Set up Google OAuth credentials in Google Cloud Console
2. Configure environment variables
3. Explore the API endpoints in the main README
4. Set up the mobile app to connect to this backend
5. Monitor logs in `logs/app.log`

## Support

For issues or questions, refer to:
- Main README.md
- API documentation
- Prisma documentation: https://www.prisma.io/docs
- Mongoose documentation: https://mongoosejs.com/docs
