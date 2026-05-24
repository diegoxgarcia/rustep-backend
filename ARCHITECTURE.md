# Rustep Backend - Architecture Documentation

## System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        Mobile App (Android)                      │
│                     Google Sign-In / JWT Auth                    │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             │ HTTPS/REST
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                     API Gateway / Load Balancer                  │
│                         (Rate Limiting)                          │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Express.js Backend Server                     │
│  ┌──────────────┬──────────────┬──────────────┬──────────────┐  │
│  │     Auth     │    Users     │    Steps     │   Stamina    │  │
│  │   Module     │   Module     │   Module     │   Module     │  │
│  ├──────────────┼──────────────┼──────────────┼──────────────┤  │
│  │   Friends    │  Rankings    │   Groups     │   Rewards    │  │
│  │   Module     │   Module     │   Module     │   Module     │  │
│  └──────────────┴──────────────┴──────────────┴──────────────┘  │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │              Middleware Layer                            │    │
│  │  • Authentication (JWT)                                  │    │
│  │  • Rate Limiting                                         │    │
│  │  • Validation                                            │    │
│  │  • Error Handling                                        │    │
│  │  • Logging                                               │    │
│  └─────────────────────────────────────────────────────────┘    │
└──────────────────┬──────────────────┬───────────────────────────┘
                   │                  │
                   │                  │
        ┌──────────▼─────────┐ ┌─────▼──────────────┐
        │    MongoDB         │ │   PostgreSQL       │
        │   (Mongoose)       │ │    (Prisma)        │
        ├────────────────────┤ ├────────────────────┤
        │ • users            │ │ • stamina_ledger   │
        │ • steps_logs       │ │ • friendships      │
        │ • fraud_flags      │ │ • running_groups   │
        │                    │ │ • group_members    │
        │                    │ │ • rankings         │
        │                    │ │ • rewards          │
        │                    │ │ • redemptions      │
        └────────────────────┘ └────────────────────┘
```

---

## Data Flow

### 1. User Authentication Flow

```
Mobile App
    │
    │ 1. Google Sign-In
    ▼
Google OAuth
    │
    │ 2. ID Token
    ▼
Backend (auth.controller)
    │
    │ 3. Verify Token
    ▼
Google API
    │
    │ 4. User Info
    ▼
MongoDB (users)
    │
    │ 5. Find/Create User
    ▼
JWT Generation
    │
    │ 6. Access + Refresh Tokens
    ▼
Mobile App (Store Tokens)
```

### 2. Steps Submission Flow

```
Mobile App
    │
    │ 1. Steps Data + Metrics
    ▼
Backend (steps.controller)
    │
    ├─────────────────┐
    │                 │
    ▼                 ▼
Fraud Detection    MongoDB
  (Service)       (steps_logs)
    │                 │
    │                 │
    │ 2. Confidence   │ 3. Save Session
    │    Score        │
    │                 │
    ▼                 ▼
MongoDB           Stamina Check
(fraud_flags)      (If Valid)
    │                 │
    │                 │
    ▼                 ▼
Update Stats    PostgreSQL
                (stamina_ledger)
                    │
                    │ 4. Credit Stamina
                    ▼
                Response to App
```

### 3. Rankings Update Flow (Cron)

```
Cron Schedule (Monday 00:00 UTC)
    │
    ▼
rankings.cron.js
    │
    │ For Each User:
    ├──────────────────┐
    │                  │
    ▼                  ▼
MongoDB           Calculate
(steps_logs)      Weekly Stats
    │                  │
    │                  │
    ▼                  ▼
Aggregate         PostgreSQL
Steps Data        (rankings)
    │                  │
    │                  │
    └──────────────────┤
                       │
                       ▼
                Update/Create
                  Rankings
```

---

## Module Architecture

### Auth Module

**Responsibility:** User authentication and authorization

```
auth/
├── auth.controller.js
│   ├── googleSignIn()      - Verify Google token
│   ├── refreshToken()      - Refresh access token
│   ├── getMe()            - Get current user
│   └── logout()           - Logout user
│
└── auth.routes.js
    - POST /auth/google
    - POST /auth/refresh
    - GET  /auth/me
    - POST /auth/logout
```

**Database:** MongoDB (users collection)

### Users Module

**Responsibility:** User profile management

```
users/
├── users.controller.js
│   ├── getUserProfile()    - Get user by ID
│   ├── updateProfile()     - Update profile
│   ├── getUserStats()      - Get statistics
│   ├── searchUsers()       - Search users
│   └── deleteAccount()     - Delete account
│
└── users.routes.js
    - GET    /users/:id
    - PUT    /users/profile
    - GET    /users/stats
    - GET    /users/search
    - DELETE /users/account
```

**Database:** MongoDB (users, steps_logs)

### Steps Module

**Responsibility:** Step tracking and fraud detection

```
steps/
├── steps.controller.js
│   ├── submitSteps()       - Submit session
│   ├── getStepsHistory()   - Get history
│   ├── getTodaySteps()     - Today's summary
│   └── getStepsStats()     - Statistics
│
├── steps.service.js
│   ├── calculateConfidenceScore()  - Fraud detection
│   ├── determineConfidenceStatus() - Status determination
│   ├── creditStamina()             - Credit stamina
│   └── getWeekNumber()             - Week calculation
│
└── steps.routes.js
    - POST /steps
    - GET  /steps/history
    - GET  /steps/today
    - GET  /steps/stats
```

**Database:** MongoDB (steps_logs, fraud_flags), PostgreSQL (stamina_ledger)

### Stamina Module

**Responsibility:** Stamina economy management

```
stamina/
├── stamina.controller.js
│   ├── getBalance()        - Current balance
│   ├── getTransactions()   - Transaction history
│   ├── getDailySummary()   - Daily summary
│   ├── spendStamina()      - Spend stamina
│   └── getStats()          - Statistics
│
└── stamina.routes.js
    - GET  /stamina/balance
    - GET  /stamina/transactions
    - GET  /stamina/daily
    - POST /stamina/spend
    - GET  /stamina/stats
```

**Database:** PostgreSQL (stamina_ledger)

### Friends Module

**Responsibility:** Social connections

```
friends/
├── friends.controller.js
│   ├── sendFriendRequest()    - Send request
│   ├── acceptFriendRequest()  - Accept request
│   ├── rejectFriendRequest()  - Reject request
│   ├── getFriends()           - List friends
│   ├── getPendingRequests()   - Pending requests
│   └── removeFriend()         - Remove friend
│
└── friends.routes.js
    - POST   /friends/request
    - PUT    /friends/accept/:id
    - PUT    /friends/reject/:id
    - GET    /friends
    - GET    /friends/pending
    - DELETE /friends/:id
```

**Database:** PostgreSQL (friendships), MongoDB (users)

### Rankings Module

**Responsibility:** Leaderboards and rankings

```
rankings/
├── rankings.controller.js
│   ├── getWeeklyRankings()   - Get rankings
│   ├── getMyPosition()       - User position
│   └── getFriendsRankings()  - Friends rankings
│
├── rankings.cron.js
│   ├── updateWeeklyRankings() - Cron job
│   └── scheduleRankingsJobs() - Schedule
│
└── rankings.routes.js
    - GET /rankings/weekly/:category
    - GET /rankings/my-position/:category
    - GET /rankings/friends/:category
```

**Database:** PostgreSQL (rankings), MongoDB (users, steps_logs)

---

## Database Schema Details

### MongoDB Schema

#### users Collection
```javascript
{
  _id: ObjectId,
  googleId: String (unique),
  email: String (unique),
  displayName: String,
  photoUrl: String,
  age: Number,
  gender: Enum,
  city: String,
  country: String,
  activityCategory: Enum,
  spotifyPlaylistUrl: String,
  showSpotifyPlaylist: Boolean,
  weeklyStepsHistory: [{
    weekNumber: Number,
    year: Number,
    totalSteps: Number,
    sessions: Number
  }],
  lastActive: Date,
  accountStatus: Enum,
  createdAt: Date,
  updatedAt: Date
}
```

#### steps_logs Collection
```javascript
{
  _id: ObjectId,
  userId: ObjectId (ref: users),
  stepsCount: Number,
  startTime: Date,
  endTime: Date,
  sessionDurationMinutes: Number,
  confidenceScore: Number (0-1),
  confidenceStatus: Enum (valid/suspicious/blocked),
  gpsVarianceMeters: Number,
  avgSpeedKmh: Number,
  stepsDistribution: [{
    minute: Number,
    steps: Number
  }],
  staminaCredited: Number,
  staminaCreditedAt: Date,
  syncedAt: Date,
  createdAt: Date,
  updatedAt: Date
}
```

#### fraud_flags Collection
```javascript
{
  _id: ObjectId,
  userId: ObjectId (ref: users, unique),
  totalSessions: Number,
  suspiciousSessions: Number,
  blockedSessions: Number,
  avgConfidenceScore: Number,
  lastSuspiciousAt: Date,
  reviewStatus: Enum,
  reviewedBy: String,
  reviewedAt: Date,
  reviewNotes: String,
  staminaFrozen: Boolean,
  suspensionEndsAt: Date,
  createdAt: Date,
  updatedAt: Date
}
```

### PostgreSQL Schema (Prisma)

#### stamina_ledger Table
```sql
CREATE TABLE stamina_ledger (
  id UUID PRIMARY KEY,
  user_id VARCHAR(255),
  amount INTEGER,  -- Positive or negative
  type TransactionType,
  reference_id VARCHAR(255),
  description VARCHAR(500),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_stamina_user ON stamina_ledger(user_id);
CREATE INDEX idx_stamina_created ON stamina_ledger(created_at);
```

#### friendships Table
```sql
CREATE TABLE friendships (
  id UUID PRIMARY KEY,
  requester_id VARCHAR(255),
  addressee_id VARCHAR(255),
  status FriendshipStatus DEFAULT 'PENDING',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(requester_id, addressee_id)
);
```

#### rankings Table
```sql
CREATE TABLE rankings (
  id UUID PRIMARY KEY,
  user_id VARCHAR(255),
  category RankingCategory,
  score INTEGER DEFAULT 0,
  week_number INTEGER,
  year INTEGER,
  rank INTEGER,
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, category, week_number, year)
);
```

---

## Security Architecture

### Authentication Flow

```
1. User signs in with Google
   ↓
2. Google returns ID token
   ↓
3. Backend verifies ID token with Google
   ↓
4. Backend finds/creates user in MongoDB
   ↓
5. Backend generates JWT access token
   ↓
6. Backend generates refresh token
   ↓
7. Tokens sent to mobile app
   ↓
8. App stores tokens securely
   ↓
9. App includes token in all requests
   ↓
10. Backend verifies token on each request
```

### Authorization Layers

```
Request
  │
  ▼
Rate Limiter (IP-based)
  │
  ▼
Authentication Middleware (JWT)
  │
  ▼
Authorization Middleware (User ownership)
  │
  ▼
Validation Middleware (Input validation)
  │
  ▼
Controller (Business logic)
  │
  ▼
Response
```

---

## Performance Optimizations

### Database Indexes

**MongoDB:**
- users: googleId, email, createdAt
- steps_logs: userId+startTime, userId+confidenceStatus, confidenceStatus
- fraud_flags: userId, reviewStatus, staminaFrozen

**PostgreSQL:**
- stamina_ledger: user_id, created_at, type
- friendships: requester_id, addressee_id, status
- rankings: category+weekNumber+year+score, user_id

### Caching Strategy

```
┌─────────────────┐
│   Redis Cache   │
│                 │
│ • User sessions │
│ • Rankings      │
│ • Leaderboards  │
│ • Config        │
└────────┬────────┘
         │
         │ Cache Miss
         ▼
    Database Query
```

### Connection Pooling

- MongoDB: Max 10 connections
- PostgreSQL: Prisma default pooling
- Redis: Connection reuse

---

## Error Handling Flow

```
Error Occurs
  │
  ▼
catchAsync() Wrapper
  │
  ▼
Error Handler Middleware
  │
  ├─ Operational Error?
  │  ├─ Yes: Send error response
  │  └─ No: Log and send generic error
  │
  ▼
Logger (Winston)
  │
  ├─ Console
  ├─ File (production)
  └─ Error tracking service
```

---

## Monitoring & Logging

### Log Levels

```
ERROR   - Application errors
WARN    - Warnings (e.g., fraud detection)
INFO    - Important events (e.g., user login)
HTTP    - Request logs
DEBUG   - Detailed debugging info
```

### Metrics to Monitor

- Request rate (per endpoint)
- Response time (p50, p95, p99)
- Error rate
- Database query time
- Cache hit rate
- Active connections
- Memory usage
- CPU usage

---

## Scalability Considerations

### Horizontal Scaling

```
┌─────────┐  ┌─────────┐  ┌─────────┐
│ Server1 │  │ Server2 │  │ Server3 │
└────┬────┘  └────┬────┘  └────┬────┘
     │            │            │
     └────────────┼────────────┘
                  │
         ┌────────▼────────┐
         │  Load Balancer  │
         └─────────────────┘
```

### Database Scaling

**MongoDB:**
- Sharding by user_id
- Read replicas for read-heavy operations
- Indexes on all query fields

**PostgreSQL:**
- Read replicas
- Connection pooling
- Partitioning large tables

---

## Deployment Architecture

```
┌──────────────────────────────────────┐
│         Load Balancer / CDN           │
└────────────┬─────────────────────────┘
             │
    ┌────────┴────────┐
    │                 │
    ▼                 ▼
┌────────┐       ┌────────┐
│ App    │       │ App    │
│ Server │       │ Server │
│ (Node) │       │ (Node) │
└───┬────┘       └───┬────┘
    │                │
    └────────┬───────┘
             │
    ┌────────┴────────┐
    │                 │
    ▼                 ▼
┌────────┐       ┌────────┐
│MongoDB │       │Postgres│
│Cluster │       │Cluster │
└────────┘       └────────┘
```

---

This architecture provides:
- Scalability
- Reliability
- Security
- Performance
- Maintainability
