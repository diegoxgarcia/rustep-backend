# Rustep Backend - Deployment Guide

This guide covers deploying the Rustep backend to various platforms.

## Table of Contents

1. [Environment Variables](#environment-variables)
2. [Database Setup](#database-setup)
3. [Docker Deployment](#docker-deployment)
4. [Cloud Platforms](#cloud-platforms)
5. [Production Checklist](#production-checklist)

---

## Environment Variables

Required environment variables for production:

```env
# Server
NODE_ENV=production
PORT=3000

# MongoDB - Use MongoDB Atlas or managed MongoDB
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/rustep?retryWrites=true&w=majority

# PostgreSQL - Use managed PostgreSQL (AWS RDS, GCP Cloud SQL, etc)
DATABASE_URL=postgresql://username:password@host:5432/rustep_postgres?schema=public

# JWT - GENERATE STRONG SECRETS!
JWT_SECRET=your-very-strong-secret-minimum-32-characters
JWT_REFRESH_SECRET=your-very-strong-refresh-secret-minimum-32-characters

# Google OAuth
GOOGLE_CLIENT_ID=your-production-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-production-client-secret
GOOGLE_CALLBACK_URL=https://your-domain.com/api/v1/auth/google/callback

# Redis (Optional but recommended)
REDIS_HOST=your-redis-host
REDIS_PORT=6379
REDIS_PASSWORD=your-redis-password

# CORS - Add your frontend domains
ALLOWED_ORIGINS=https://your-frontend.com,https://www.your-frontend.com

# Stamina Configuration
STAMINA_PER_1K_STEPS=10
MAX_STAMINA_PER_DAY=100
FRAUD_THRESHOLD_CONFIDENCE=0.4

# Logging
LOG_LEVEL=info
LOG_FILE_PATH=/var/log/rustep/app.log
```

---

## Database Setup

### MongoDB Atlas (Recommended)

1. Create a free account at [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Create a new cluster
3. Create a database user
4. Whitelist your application's IP addresses
5. Get connection string and add to `.env`

### PostgreSQL (Managed Service)

**Option 1: AWS RDS**
```bash
# Create RDS PostgreSQL instance
aws rds create-db-instance \
  --db-instance-identifier rustep-postgres \
  --db-instance-class db.t3.micro \
  --engine postgres \
  --master-username rustep \
  --master-user-password <password> \
  --allocated-storage 20
```

**Option 2: Google Cloud SQL**
```bash
gcloud sql instances create rustep-postgres \
  --database-version=POSTGRES_14 \
  --tier=db-f1-micro \
  --region=us-central1
```

**Option 3: DigitalOcean Managed Database**
- Create via DigitalOcean dashboard
- Copy connection string

### Run Migrations

After setting up databases:

```bash
# Generate Prisma client
npm run prisma:generate

# Run migrations
npm run prisma:migrate

# Seed data (optional)
npm run seed
```

---

## Docker Deployment

### Build Docker Image

```bash
docker build -t rustep-backend:latest .
```

### Run with Docker Compose

1. Update `docker-compose.yml` with production values
2. Start services:

```bash
docker-compose up -d
```

### Push to Docker Registry

```bash
# Tag image
docker tag rustep-backend:latest your-registry/rustep-backend:latest

# Push
docker push your-registry/rustep-backend:latest
```

---

## Cloud Platforms

### 1. AWS Elastic Beanstalk

**Setup:**

```bash
# Install EB CLI
pip install awsebcli

# Initialize
eb init -p node.js rustep-backend

# Create environment
eb create production

# Deploy
eb deploy
```

**Configuration:**
- Set environment variables in EB Console
- Use RDS for PostgreSQL
- Use DocumentDB or MongoDB Atlas for MongoDB

### 2. Google Cloud Run

**Setup:**

```bash
# Build and push to GCR
gcloud builds submit --tag gcr.io/PROJECT_ID/rustep-backend

# Deploy
gcloud run deploy rustep-backend \
  --image gcr.io/PROJECT_ID/rustep-backend \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars="NODE_ENV=production,MONGODB_URI=..."
```

### 3. Heroku

**Setup:**

```bash
# Login
heroku login

# Create app
heroku create rustep-backend

# Add MongoDB addon
heroku addons:create mongolab:sandbox

# Add PostgreSQL addon
heroku addons:create heroku-postgresql:hobby-dev

# Set environment variables
heroku config:set NODE_ENV=production
heroku config:set JWT_SECRET=your-secret

# Deploy
git push heroku main

# Run migrations
heroku run npm run prisma:migrate
```

### 4. DigitalOcean App Platform

1. Connect your GitHub repository
2. Select Node.js environment
3. Add environment variables
4. Add MongoDB and PostgreSQL databases
5. Deploy

### 5. Railway.app

1. Login to [Railway](https://railway.app)
2. New Project > Deploy from GitHub repo
3. Add PostgreSQL and MongoDB plugins
4. Set environment variables
5. Deploy automatically on push

### 6. Render.com

1. Create new Web Service
2. Connect GitHub repository
3. Build command: `npm install && npm run prisma:generate`
4. Start command: `npm start`
5. Add PostgreSQL and MongoDB databases
6. Set environment variables

---

## Production Checklist

### Security

- [ ] Use strong JWT secrets (min 32 characters)
- [ ] Enable HTTPS only
- [ ] Configure CORS properly
- [ ] Set secure cookie flags
- [ ] Rate limiting enabled
- [ ] Input validation on all endpoints
- [ ] SQL injection protection (Prisma ORM)
- [ ] MongoDB injection protection (Mongoose)
- [ ] Keep dependencies updated

### Database

- [ ] Backups configured
- [ ] Indexes created (automatic with Mongoose/Prisma)
- [ ] Connection pooling configured
- [ ] SSL/TLS enabled
- [ ] Monitor query performance

### Monitoring

- [ ] Error tracking (Sentry, Rollbar, etc.)
- [ ] Application monitoring (New Relic, Datadog, etc.)
- [ ] Log aggregation (LogDNA, Papertrail, etc.)
- [ ] Uptime monitoring (Pingdom, UptimeRobot)
- [ ] Database monitoring

### Performance

- [ ] Enable compression
- [ ] Cache frequently accessed data (Redis)
- [ ] Optimize database queries
- [ ] Set appropriate rate limits
- [ ] Use CDN for static assets

### Scalability

- [ ] Horizontal scaling ready (stateless)
- [ ] Database connection pooling
- [ ] Redis for session storage
- [ ] Load balancer configured
- [ ] Auto-scaling rules set

### Logging

- [ ] Structured logging enabled
- [ ] Log rotation configured
- [ ] Error logs monitored
- [ ] Access logs enabled
- [ ] Sensitive data not logged

### Documentation

- [ ] API documentation up to date
- [ ] Deployment guide documented
- [ ] Environment variables documented
- [ ] Disaster recovery plan
- [ ] Incident response plan

---

## Environment-Specific Configurations

### Development
```env
NODE_ENV=development
LOG_LEVEL=debug
```

### Staging
```env
NODE_ENV=staging
LOG_LEVEL=info
```

### Production
```env
NODE_ENV=production
LOG_LEVEL=warn
```

---

## Health Checks

Configure health check endpoints for load balancers:

**Endpoint:** `GET /health`

**Expected Response:** 200 OK
```json
{
  "status": "ok",
  "timestamp": "...",
  "uptime": 12345
}
```

---

## Scaling Strategies

### Horizontal Scaling

1. Deploy multiple instances
2. Use load balancer (ALB, NGINX, etc.)
3. Ensure stateless architecture
4. Use Redis for shared sessions

### Vertical Scaling

1. Increase server resources
2. Monitor CPU/Memory usage
3. Optimize code bottlenecks

### Database Scaling

1. Read replicas for read-heavy workloads
2. Sharding for large datasets
3. Connection pooling
4. Query optimization

---

## Backup Strategy

### MongoDB
```bash
# Automated daily backups
mongodump --uri="mongodb+srv://..." --out=/backup/$(date +%Y%m%d)

# Restore
mongorestore --uri="mongodb+srv://..." /backup/20240524
```

### PostgreSQL
```bash
# Automated daily backups
pg_dump $DATABASE_URL > /backup/rustep_$(date +%Y%m%d).sql

# Restore
psql $DATABASE_URL < /backup/rustep_20240524.sql
```

---

## Troubleshooting

### High Memory Usage
- Check for memory leaks
- Monitor active connections
- Review query performance

### Slow Response Times
- Enable query logging
- Add database indexes
- Implement caching
- Profile code performance

### Connection Errors
- Check database connection limits
- Verify network security groups
- Review firewall rules
- Test DNS resolution

---

## Support

For deployment issues:
- Check logs: `npm run logs` or cloud platform logs
- Review error tracking (Sentry)
- Monitor application metrics
- Contact DevOps team

## Next Steps

After deployment:
1. Configure monitoring alerts
2. Set up automated backups
3. Implement CI/CD pipeline
4. Load testing
5. Security audit
6. Performance optimization
