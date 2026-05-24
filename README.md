# Rustep Backend API

Backend API for Rustep - A gamified fitness tracking application with step counting, stamina system, and social features.

## Tech Stack

- **Node.js** - Runtime environment
- **Express.js** - Web framework
- **MongoDB** (Mongoose) - User data, steps logs, fraud detection
- **PostgreSQL** (Prisma) - Stamina ledger, friendships, rankings, rewards
- **JWT** - Authentication
- **Google OAuth** - Sign-in provider
- **Redis** (Optional) - Caching

## Project Structure

```
rustep-backend/
├── src/
│   ├── config/           # Configuration files
│   │   ├── env.config.js
│   │   ├── mongodb.config.js
│   │   └── postgres.config.js
│   ├── middleware/       # Express middleware
│   │   ├── auth.js
│   │   ├── errorHandler.js
│   │   ├── notFound.js
│   │   ├── rateLimit.js
│   │   └── validate.js
│   ├── modules/          # Feature modules
│   │   ├── auth/         # Authentication
│   │   ├── users/        # User management
│   │   ├── steps/        # Steps tracking
│   │   ├── stamina/      # Stamina system
│   │   ├── friends/      # Social features
│   │   └── rankings/     # Leaderboards
│   ├── utils/            # Utility functions
│   │   ├── logger.js
│   │   ├── appError.js
│   │   ├── catchAsync.js
│   │   └── response.js
│   ├── app.js            # Express app setup
│   └── server.js         # Server entry point
├── models/               # MongoDB models
│   ├── User.js
│   ├── StepsLog.js
│   └── FraudFlag.js
├── prisma/               # PostgreSQL schema
│   └── schema.prisma
├── package.json
└── .env.example
```

## Installation

1. Clone the repository
2. Install dependencies:

```bash
npm install
```

3. Set up environment variables:

```bash
cp .env.example .env
# Edit .env with your configuration
```

4. Generate Prisma client:

```bash
npm run prisma:generate
```

5. Run database migrations:

```bash
npm run prisma:migrate
```

## Environment Variables

See `.env.example` for all required environment variables:

- MongoDB connection string
- PostgreSQL connection string
- JWT secrets
- Google OAuth credentials
- Stamina configuration
- Rate limiting settings

## Running the Server

### Development mode:

```bash
npm run dev
```

### Production mode:

```bash
npm start
```

## API Endpoints

### Authentication
- `POST /api/v1/auth/google` - Google Sign-In
- `POST /api/v1/auth/refresh` - Refresh access token
- `GET /api/v1/auth/me` - Get current user
- `POST /api/v1/auth/logout` - Logout

### Users
- `GET /api/v1/users/:id` - Get user profile
- `PUT /api/v1/users/profile` - Update profile
- `GET /api/v1/users/stats` - Get user statistics
- `GET /api/v1/users/search` - Search users
- `DELETE /api/v1/users/account` - Delete account

### Steps
- `POST /api/v1/steps` - Submit steps session
- `GET /api/v1/steps/history` - Get steps history
- `GET /api/v1/steps/today` - Get today's steps
- `GET /api/v1/steps/stats` - Get steps statistics

### Stamina
- `GET /api/v1/stamina/balance` - Get stamina balance
- `GET /api/v1/stamina/transactions` - Get transaction history
- `GET /api/v1/stamina/daily` - Get daily summary
- `GET /api/v1/stamina/stats` - Get stamina statistics
- `POST /api/v1/stamina/spend` - Spend stamina

### Friends
- `POST /api/v1/friends/request` - Send friend request
- `PUT /api/v1/friends/accept/:friendshipId` - Accept request
- `PUT /api/v1/friends/reject/:friendshipId` - Reject request
- `GET /api/v1/friends` - Get friends list
- `GET /api/v1/friends/pending` - Get pending requests
- `DELETE /api/v1/friends/:friendshipId` - Remove friend

### Rankings
- `GET /api/v1/rankings/weekly/:category` - Get weekly rankings
- `GET /api/v1/rankings/my-position/:category` - Get user position
- `GET /api/v1/rankings/friends/:category` - Get friends rankings

## Database Models

### MongoDB (Mongoose)

**User**: User profiles and weekly steps history
**StepsLog**: Individual step counting sessions with fraud detection
**FraudFlag**: Fraud detection metrics per user

### PostgreSQL (Prisma)

**StaminaLedger**: Transaction log for stamina movements
**Friendship**: Social connections between users
**RunningGroup**: Group challenges and activities
**GroupMember**: Members of running groups
**Ranking**: Weekly leaderboards
**Reward**: Available rewards catalog
**RewardRedemption**: User reward claims

## Fraud Detection

The system includes automatic fraud detection for step submissions:

- **Confidence Score**: 0-1 score based on multiple factors
- **Factors Analyzed**:
  - Steps per minute
  - GPS variance
  - Average speed
  - Steps distribution consistency
  - Session duration

**Thresholds**:
- Valid: score >= 0.7
- Suspicious: 0.4 <= score < 0.7
- Blocked: score < 0.4

## Stamina System

- Users earn stamina by walking/running
- 10 stamina per 1,000 steps (configurable)
- Maximum 100 stamina per day (configurable)
- Only valid sessions credit stamina
- Stamina can be spent on rewards

## Cron Jobs

**Weekly Rankings Update**: Runs every Monday at midnight (UTC)
- Updates WEEKLY_STEPS rankings
- Updates WEEKLY_SESSIONS rankings
- Updates WEEKLY_STAMINA rankings
- Updates ALL_TIME_STEPS rankings

## Scripts

```bash
npm start              # Start production server
npm run dev            # Start development server
npm run prisma:generate  # Generate Prisma client
npm run prisma:migrate   # Run database migrations
npm run prisma:studio    # Open Prisma Studio
npm test               # Run tests
npm run lint           # Run ESLint
```

## Security Features

- Helmet.js for security headers
- CORS configuration
- Rate limiting (general, auth, steps)
- JWT authentication
- Input validation
- Error handling

## License

MIT
