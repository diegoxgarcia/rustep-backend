# Changelog

All notable changes to the Rustep Backend will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.2.0] - 2026-06-17

### Added — Daily steps model (podómetro)

- `POST /api/v1/steps/daily` — endpoint principal para pasos del contador diario. Recibe `{ days: [{date, steps}] }` (total acumulado por día, máx 31 días). Hace **upsert por (usuario, día)**: un solo `steps_log` por día (`source: "daily"`) y acredita stamina **solo sobre el delta** del total, evitando duplicados al re-sincronizar un día que sigue creciendo.
- `StepsLog.source` (`'session' | 'daily'`, default `'session'`) + índice `{userId, source, startTime}` para el upsert.
- `stepsService.creditStaminaForDailyDelta(userId, oldTotal, newTotal, refId)` — crédito exacto por incremento: `stamina(newTotal) − stamina(oldTotal)`, respetando el tope diario.

### Changed

- `GET /steps/weekly-summary` ahora incluye `dailyBreakdown`: array de los 7 días de la semana ISO (`{date, steps}`), para el gráfico semanal de la app.
- `GET /steps/today` y `GET /steps/weekly-summary` aceptan `?date=YYYY-MM-DD` (opcional): fecha **local del cliente** usada como referencia de "hoy"/"semana". Sin esto, un usuario en huso negativo que sincroniza de noche guardaba el día local pero el server lo buscaba en el día UTC siguiente → devolvía 0. La app móvil ahora manda su fecha local. Fallback: día UTC del server.

### Fixed

- `StepsLog`: `sessionDurationMinutes` ahora se calcula en un hook `pre('validate')` (antes era `pre('save')`, que corre **después** de la validación → fallaba con "Path `sessionDurationMinutes` is required" al crear documentos en `POST /steps/daily` y `POST /steps/sync`).

### Notes

- Motivo: Health Connect almacena pasos como muchos `StepsRecord` (intervalos), no como sesiones. La app móvil ahora lee el **total agregado por día** y lo sincroniza por este endpoint. `POST /steps/sync` (sesiones/ejercicio) y `POST /steps` (legacy) se mantienen.
- Conversión a stamina: **1 stamina cada 1000 pasos** (`STAMINA_PER_1K_STEPS=10`), tope **100/día**. Menos de 1000 pasos acredita 0.

---

## [1.1.0] - 2026-05-31

### Added — Mobile App Support

#### Steps Module
- `POST /api/v1/steps/sync` — batch sync endpoint (principal para la app mobile). Acepta array de hasta 50 sesiones de Health Connect en un solo request. Devuelve `{sessionsProcessed, stepsAccepted, staminaCredited, staminaInQuarantine, warnings}`.
- `GET /api/v1/steps/weekly-summary` — resumen de la semana ISO actual: pasos totales, progreso hacia umbral de torneos (`WEEKLY_STEPS_THRESHOLD`, default 14.000), stamina ganada, días activos consecutivos.
- `stepsService.deriveGpsMetrics(gpsPoints, start, end)` — calcula `gpsVarianceMeters` y `avgSpeedKmh` desde array de puntos GPS `{lat, lng, timestamp}` usando Haversine. Usado cuando el cliente envía puntos crudos en vez de métricas pre-computadas.

#### Response shape unificada
- `POST /api/v1/steps` (single session legacy) ahora devuelve el mismo shape que el batch sync para consistencia.

#### CORS
- Requests sin header `Origin` (apps nativas Android/iOS) ahora permitidos explícitamente. Clientes browser siguen validándose contra `ALLOWED_ORIGINS`.

### Changed
- `POST /api/v1/steps` response cambió de `{stepsLog: {...}}` a `{sessionsProcessed, stepsAccepted, staminaCredited, staminaInQuarantine, warnings}`.

---

## [1.0.0] - 2024-05-24

### Added - Initial Release

#### Core Infrastructure
- Express.js server setup with modular architecture
- MongoDB integration with Mongoose ODM
- PostgreSQL integration with Prisma ORM
- Winston logging system
- Environment-based configuration management
- Docker and Docker Compose setup
- Comprehensive error handling system

#### Authentication & Security
- Google OAuth 2.0 sign-in integration
- JWT-based authentication with refresh tokens
- Rate limiting middleware (general, auth-specific, and steps-specific)
- Helmet.js security headers
- CORS configuration
- Input validation with express-validator

#### User Management
- User profile creation and management
- User statistics and analytics
- User search functionality
- Account deletion capability
- Weekly steps history tracking

#### Steps Tracking & Fraud Detection
- Steps session submission
- Real-time fraud detection algorithm
- Confidence score calculation (0-1 scale)
- Multi-factor fraud analysis:
  - Steps per minute validation
  - GPS variance tracking
  - Average speed validation
  - Steps distribution consistency
  - Session duration validation
- Automatic session flagging (valid/suspicious/blocked)
- Fraud statistics per user
- Steps history and statistics

#### Stamina Economy
- Stamina earning from valid steps (10 per 1000 steps)
- Daily stamina cap (100 stamina/day)
- Stamina transaction ledger
- Balance tracking
- Transaction history
- Stamina spending system
- Daily and overall statistics

#### Social Features
- Friend request system
- Friend acceptance/rejection
- Friends list management
- Pending requests tracking
- Friend removal
- Cross-database friend queries (MongoDB + PostgreSQL)

#### Rankings & Leaderboards
- Weekly rankings system
- Multiple ranking categories:
  - Weekly steps
  - Weekly stamina
  - Weekly sessions
  - All-time steps
- User position tracking
- Friends-only leaderboards
- Automated weekly ranking updates (cron job)

#### Database Architecture
**MongoDB Collections:**
- users (profiles, weekly history, Spotify integration)
- steps_logs (sessions, fraud metrics, stamina credits)
- fraud_flags (per-user fraud statistics)

**PostgreSQL Tables:**
- stamina_ledger (transaction log)
- friendships (social connections)
- running_groups (group challenges)
- group_members (membership)
- rankings (leaderboards)
- rewards (reward catalog)
- reward_redemptions (user claims)

#### Documentation
- Comprehensive README.md
- Quick Start Guide
- Complete API Documentation
- Architecture Documentation
- Deployment Guide
- Project Summary
- Index/Navigation Guide
- Changelog

#### Development Tools
- ESLint configuration
- Prettier code formatting
- Jest testing framework
- Example test files
- Setup script (bash)
- Database seeding script

#### API Endpoints (27 total)
**Authentication (4):**
- POST /auth/google
- POST /auth/refresh
- GET /auth/me
- POST /auth/logout

**Users (5):**
- GET /users/:id
- PUT /users/profile
- GET /users/stats
- GET /users/search
- DELETE /users/account

**Steps (4):**
- POST /steps
- GET /steps/history
- GET /steps/today
- GET /steps/stats

**Stamina (5):**
- GET /stamina/balance
- GET /stamina/transactions
- GET /stamina/daily
- POST /stamina/spend
- GET /stamina/stats

**Friends (6):**
- POST /friends/request
- PUT /friends/accept/:id
- PUT /friends/reject/:id
- GET /friends
- GET /friends/pending
- DELETE /friends/:id

**Rankings (3):**
- GET /rankings/weekly/:category
- GET /rankings/my-position/:category
- GET /rankings/friends/:category

#### Performance & Scalability
- Database indexing on all frequently queried fields
- Connection pooling for both databases
- Response compression
- Efficient aggregation queries
- Optimized database queries
- Stateless architecture for horizontal scaling

#### Monitoring & Logging
- Winston logger with multiple transports
- Request logging with Morgan
- Error tracking and reporting
- Health check endpoint
- Environment-specific log levels

---

## [Unreleased]

### Planned Features

#### Near-term (v1.1.0)
- [ ] Push notifications integration
- [ ] Email notifications system
- [ ] Advanced fraud detection with machine learning
- [ ] Redis caching layer
- [ ] Admin dashboard endpoints
- [ ] Group challenges implementation
- [ ] Achievement badges system
- [ ] Weekly/monthly reports

#### Mid-term (v1.2.0)
- [ ] WebSocket support for real-time features
- [ ] Social activity feed
- [ ] Advanced analytics dashboard
- [ ] Route tracking and mapping
- [ ] Photo sharing
- [ ] Challenge creation system
- [ ] In-app messaging

#### Long-term (v2.0.0)
- [ ] GraphQL API
- [ ] Microservices architecture
- [ ] Event-driven architecture
- [ ] Advanced ML-based fraud detection
- [ ] Real-time leaderboards
- [ ] Data analytics pipeline
- [ ] Multi-language support
- [ ] Third-party integrations (Strava, Fitbit, etc.)

### Known Issues
- None reported yet

---

## Version History

### [1.0.0] - 2024-05-24
- Initial release with core functionality

---

## Migration Guide

### From v0.x to v1.0.0
This is the initial release, no migration needed.

---

## Breaking Changes

### v1.0.0
- Initial API contract established

---

## Deprecation Notices

None at this time.

---

## Security Updates

### v1.0.0
- JWT authentication implemented
- Rate limiting enabled
- Input validation added
- SQL/NoSQL injection prevention
- XSS protection via Helmet.js

---

## Performance Improvements

### v1.0.0
- Database indexing optimized
- Response compression enabled
- Connection pooling configured
- Efficient query patterns established

---

## Contributors

- Rustep Development Team

---

## Support

For issues, questions, or feature requests:
- GitHub Issues: [Create an issue]
- Email: support@rustep.com
- Documentation: See README.md

---

**Note:** This changelog follows [Keep a Changelog](https://keepachangelog.com/) format.
Types of changes:
- `Added` for new features
- `Changed` for changes in existing functionality
- `Deprecated` for soon-to-be removed features
- `Removed` for now removed features
- `Fixed` for any bug fixes
- `Security` for vulnerability fixes
