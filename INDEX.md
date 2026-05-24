# Rustep Backend - Documentation Index

Welcome to the Rustep Backend documentation. This index will guide you through all available documentation files.

---

## Quick Navigation

### Getting Started
1. **[QUICK_START.md](QUICK_START.md)** - Get up and running in 5 minutes
2. **[README.md](README.md)** - Main documentation and overview
3. **[PROJECT_SUMMARY.md](PROJECT_SUMMARY.md)** - Complete project summary

### Development
4. **[API_DOCUMENTATION.md](API_DOCUMENTATION.md)** - Complete API reference with examples
5. **[ARCHITECTURE.md](ARCHITECTURE.md)** - System architecture and design

### Deployment
6. **[DEPLOYMENT.md](DEPLOYMENT.md)** - Production deployment guide

---

## Documentation Overview

### 1. QUICK_START.md
**Purpose:** Get the backend running quickly

**Contents:**
- Prerequisites
- Quick setup (Docker & Manual)
- Testing the API
- Common commands
- Troubleshooting

**Best for:** Developers who want to start immediately

---

### 2. README.md
**Purpose:** Main project documentation

**Contents:**
- Tech stack overview
- Project structure
- Installation instructions
- API endpoints summary
- Database models
- Fraud detection system
- Stamina system
- Cron jobs
- Security features

**Best for:** Understanding the overall project

---

### 3. PROJECT_SUMMARY.md
**Purpose:** Comprehensive project overview

**Contents:**
- Complete project structure
- Technology stack details
- Database architecture
- Key features explanation
- API endpoints list
- Configuration guide
- Scheduled tasks
- Security features
- Performance optimizations
- Testing guide
- Future enhancements

**Best for:** Deep dive into the project

---

### 4. API_DOCUMENTATION.md
**Purpose:** Complete API reference

**Contents:**
- Authentication endpoints
- User management endpoints
- Steps tracking endpoints
- Stamina management endpoints
- Friends/social endpoints
- Rankings endpoints
- Request/response examples
- Error responses
- Rate limits
- Fraud detection details

**Best for:** API integration and testing

---

### 5. ARCHITECTURE.md
**Purpose:** System architecture documentation

**Contents:**
- System architecture diagram
- Data flow diagrams
- Module architecture
- Database schema details
- Security architecture
- Performance optimizations
- Scalability considerations
- Deployment architecture
- Monitoring & logging

**Best for:** Understanding system design

---

### 6. DEPLOYMENT.md
**Purpose:** Production deployment guide

**Contents:**
- Environment variables
- Database setup
- Docker deployment
- Cloud platform guides (AWS, GCP, Heroku, etc.)
- Production checklist
- Backup strategy
- Troubleshooting
- Monitoring setup

**Best for:** Deploying to production

---

## Additional Files

### Configuration Files

**package.json**
- Dependencies
- Scripts
- Project metadata

**.env.example**
- Environment variable template
- Configuration examples

**.eslintrc.js**
- ESLint configuration
- Code quality rules

**.prettierrc**
- Code formatting rules

**jest.config.js**
- Test configuration

---

### Docker Files

**Dockerfile**
- Docker image configuration
- Multi-stage build

**docker-compose.yml**
- Local development setup
- MongoDB + PostgreSQL + Redis + API

---

### Database Files

**prisma/schema.prisma**
- PostgreSQL database schema
- Table definitions
- Relationships
- Enums

**prisma/seed.js**
- Sample data seeding script

**models/User.js**
- MongoDB User schema

**models/StepsLog.js**
- MongoDB StepsLog schema

**models/FraudFlag.js**
- MongoDB FraudFlag schema

---

### Source Code Structure

```
src/
├── config/              # Configuration
│   ├── env.config.js
│   ├── mongodb.config.js
│   └── postgres.config.js
│
├── middleware/          # Express middleware
│   ├── auth.js
│   ├── errorHandler.js
│   ├── notFound.js
│   ├── rateLimit.js
│   └── validate.js
│
├── modules/             # Feature modules
│   ├── auth/           # Authentication
│   ├── users/          # User management
│   ├── steps/          # Steps tracking
│   ├── stamina/        # Stamina economy
│   ├── friends/        # Social features
│   └── rankings/       # Leaderboards
│
├── utils/              # Utilities
│   ├── logger.js
│   ├── appError.js
│   ├── catchAsync.js
│   └── response.js
│
├── app.js              # Express setup
└── server.js           # Entry point
```

---

## Reading Paths

### For New Developers
1. QUICK_START.md (setup)
2. README.md (overview)
3. API_DOCUMENTATION.md (API reference)
4. Code exploration

### For API Consumers
1. API_DOCUMENTATION.md (endpoints)
2. README.md (authentication)
3. Testing with provided examples

### For DevOps/Deployment
1. DEPLOYMENT.md (deployment)
2. ARCHITECTURE.md (system design)
3. .env.example (configuration)
4. docker-compose.yml (containers)

### For System Architects
1. ARCHITECTURE.md (system design)
2. PROJECT_SUMMARY.md (features)
3. Database schemas (prisma/models)

### For QA/Testing
1. API_DOCUMENTATION.md (endpoints)
2. tests/ directory (test examples)
3. jest.config.js (test config)

---

## Key Features by Module

### Auth Module
- Google OAuth integration
- JWT authentication
- Token refresh
- Session management

### Users Module
- Profile management
- User statistics
- User search
- Account management

### Steps Module
- Session tracking
- Fraud detection
- Confidence scoring
- History management

### Stamina Module
- Balance tracking
- Transaction history
- Earning/spending
- Daily limits

### Friends Module
- Friend requests
- Friend management
- Social connections

### Rankings Module
- Weekly leaderboards
- Multiple categories
- Friends rankings
- Position tracking

---

## Database Information

### MongoDB Collections
- **users** - User profiles and metadata
- **steps_logs** - Step counting sessions
- **fraud_flags** - Fraud detection metrics

### PostgreSQL Tables
- **stamina_ledger** - Stamina transactions
- **friendships** - Social connections
- **running_groups** - Group challenges
- **group_members** - Group membership
- **rankings** - Leaderboards
- **rewards** - Reward catalog
- **reward_redemptions** - User redemptions

---

## API Endpoints Summary

**Auth:** 4 endpoints
**Users:** 5 endpoints
**Steps:** 4 endpoints
**Stamina:** 5 endpoints
**Friends:** 6 endpoints
**Rankings:** 3 endpoints

**Total:** 27 REST endpoints

---

## Technology Stack

**Backend:**
- Node.js v18+
- Express.js v4
- MongoDB + Mongoose
- PostgreSQL + Prisma
- JWT authentication

**Security:**
- Helmet.js
- Rate limiting
- Input validation
- Error handling

**Development:**
- ESLint + Prettier
- Jest (testing)
- Docker
- Winston (logging)

---

## Next Steps

1. **First Time Setup**
   - Read QUICK_START.md
   - Set up environment
   - Run the application

2. **Development**
   - Read API_DOCUMENTATION.md
   - Explore code structure
   - Run tests

3. **Deployment**
   - Read DEPLOYMENT.md
   - Configure environment
   - Deploy to platform

4. **Understanding**
   - Read ARCHITECTURE.md
   - Review PROJECT_SUMMARY.md
   - Study database schemas

---

## Support & Resources

**Documentation Files:**
- All .md files in root directory
- Inline code comments
- API endpoint descriptions

**External Resources:**
- [Express.js Documentation](https://expressjs.com/)
- [Mongoose Documentation](https://mongoosejs.com/)
- [Prisma Documentation](https://www.prisma.io/docs)
- [Node.js Documentation](https://nodejs.org/docs/)

**Contact:**
- GitHub Issues
- Email: support@rustep.com

---

## Version Information

**Current Version:** 1.0.0
**Node.js Required:** >= 18.0.0
**MongoDB Required:** >= 6.0
**PostgreSQL Required:** >= 14.0

---

**Happy Coding!**

Built with Node.js, Express, MongoDB, and PostgreSQL
Developed for Rustep - The Fitness Casual Game
