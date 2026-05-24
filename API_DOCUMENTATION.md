# Rustep API Documentation

Complete API reference for Rustep backend.

Base URL: `http://localhost:3000/api/v1`

## Authentication

All endpoints except `/auth/google` and `/auth/refresh` require a valid JWT token in the Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

---

## Auth Module

### Google Sign-In

**Endpoint:** `POST /auth/google`

**Request:**
```json
{
  "idToken": "google-id-token-from-client"
}
```

**Response:** (200 OK)
```json
{
  "success": true,
  "message": "Authentication successful",
  "data": {
    "user": {
      "id": "507f1f77bcf86cd799439011",
      "email": "user@example.com",
      "displayName": "John Doe",
      "photoUrl": "https://example.com/photo.jpg",
      "age": null,
      "gender": null,
      "city": null,
      "country": null,
      "activityCategory": "sedentary"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

### Get Current User

**Endpoint:** `GET /auth/me`

**Headers:** `Authorization: Bearer <token>`

**Response:** (200 OK)
```json
{
  "success": true,
  "message": "User retrieved successfully",
  "data": {
    "user": {
      "id": "507f1f77bcf86cd799439011",
      "email": "user@example.com",
      "displayName": "John Doe",
      "photoUrl": "https://example.com/photo.jpg",
      "age": 25,
      "gender": "male",
      "city": "Madrid",
      "country": "Spain",
      "activityCategory": "moderately_active"
    }
  }
}
```

---

## Users Module

### Update Profile

**Endpoint:** `PUT /users/profile`

**Request:**
```json
{
  "displayName": "John Doe",
  "age": 25,
  "gender": "male",
  "city": "Madrid",
  "country": "Spain",
  "activityCategory": "moderately_active",
  "spotifyPlaylistUrl": "https://open.spotify.com/playlist/...",
  "showSpotifyPlaylist": true
}
```

**Response:** (200 OK)
```json
{
  "success": true,
  "message": "Profile updated successfully",
  "data": {
    "user": { /* updated user object */ }
  }
}
```

### Get User Statistics

**Endpoint:** `GET /users/stats`

**Response:** (200 OK)
```json
{
  "success": true,
  "message": "User stats retrieved successfully",
  "data": {
    "totalSteps": 125000,
    "validSteps": 120000,
    "totalSessions": 45,
    "weeklySteps": 12500,
    "weeklyHistory": [
      {
        "weekNumber": 20,
        "year": 2024,
        "totalSteps": 35000,
        "sessions": 12
      }
    ]
  }
}
```

### Search Users

**Endpoint:** `GET /users/search?query=john&limit=10`

**Response:** (200 OK)
```json
{
  "success": true,
  "message": "Users found",
  "data": {
    "users": [
      {
        "_id": "507f1f77bcf86cd799439011",
        "displayName": "John Doe",
        "email": "john@example.com",
        "photoUrl": "https://...",
        "city": "Madrid",
        "country": "Spain"
      }
    ]
  }
}
```

---

## Steps Module

### Submit Steps Session

**Endpoint:** `POST /steps`

**Request:**
```json
{
  "stepsCount": 5000,
  "startTime": "2024-05-24T10:00:00Z",
  "endTime": "2024-05-24T10:45:00Z",
  "gpsVarianceMeters": 250,
  "avgSpeedKmh": 8.5,
  "stepsDistribution": [
    { "minute": 1, "steps": 110 },
    { "minute": 2, "steps": 115 },
    { "minute": 3, "steps": 112 }
  ]
}
```

**Response:** (201 Created)
```json
{
  "success": true,
  "message": "Steps submitted successfully",
  "data": {
    "stepsLog": {
      "id": "507f1f77bcf86cd799439011",
      "stepsCount": 5000,
      "confidenceScore": 0.85,
      "confidenceStatus": "valid",
      "staminaCredited": 50
    }
  }
}
```

**Confidence Status:**
- `valid`: Score >= 0.7 (stamina credited)
- `suspicious`: 0.4 <= Score < 0.7 (flagged for review)
- `blocked`: Score < 0.4 (no stamina)

### Get Today's Steps

**Endpoint:** `GET /steps/today`

**Response:** (200 OK)
```json
{
  "success": true,
  "message": "Today steps retrieved successfully",
  "data": {
    "totalSteps": 8500,
    "validSteps": 8000,
    "totalStamina": 80,
    "sessionsCount": 3,
    "sessions": [ /* array of today's sessions */ ]
  }
}
```

### Get Steps History

**Endpoint:** `GET /steps/history?startDate=2024-05-01&endDate=2024-05-31&page=1&limit=20`

**Response:** (200 OK)
```json
{
  "success": true,
  "message": "Steps history retrieved successfully",
  "data": {
    "stepsLogs": [ /* array of steps logs */ ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 45,
      "totalPages": 3
    }
  }
}
```

---

## Stamina Module

### Get Balance

**Endpoint:** `GET /stamina/balance`

**Response:** (200 OK)
```json
{
  "success": true,
  "message": "Stamina balance retrieved successfully",
  "data": {
    "balance": 1250
  }
}
```

### Get Transactions

**Endpoint:** `GET /stamina/transactions?page=1&limit=20&type=STEPS_CREDIT`

**Transaction Types:**
- `STEPS_CREDIT` - Stamina earned from steps
- `DAILY_BONUS` - Daily login bonus
- `WEEKLY_BONUS` - Weekly achievement
- `FRIEND_BONUS` - From friend activities
- `REWARD_DEBIT` - Spent on rewards
- `ADMIN_ADJUSTMENT` - Manual adjustment
- `REFUND` - Refund from cancelled transaction

**Response:** (200 OK)
```json
{
  "success": true,
  "message": "Stamina transactions retrieved successfully",
  "data": {
    "transactions": [
      {
        "id": "uuid",
        "userId": "507f1f77bcf86cd799439011",
        "amount": 50,
        "type": "STEPS_CREDIT",
        "referenceId": "steps-log-id",
        "description": "Stamina from 5000 steps",
        "createdAt": "2024-05-24T10:45:00Z"
      }
    ],
    "pagination": { /* pagination info */ }
  }
}
```

### Get Daily Summary

**Endpoint:** `GET /stamina/daily`

**Response:** (200 OK)
```json
{
  "success": true,
  "message": "Daily stamina summary retrieved successfully",
  "data": {
    "today": {
      "earned": 80,
      "spent": 20,
      "net": 60,
      "transactionsCount": 5
    }
  }
}
```

### Spend Stamina

**Endpoint:** `POST /stamina/spend`

**Request:**
```json
{
  "amount": 500,
  "description": "Premium Theme Pack",
  "referenceId": "reward-id"
}
```

**Response:** (200 OK)
```json
{
  "success": true,
  "message": "Stamina spent successfully",
  "data": {
    "transaction": { /* transaction object */ },
    "newBalance": 750
  }
}
```

---

## Friends Module

### Send Friend Request

**Endpoint:** `POST /friends/request`

**Request:**
```json
{
  "addresseeId": "507f1f77bcf86cd799439012"
}
```

**Response:** (201 Created)
```json
{
  "success": true,
  "message": "Friend request sent successfully",
  "data": {
    "friendship": {
      "id": "uuid",
      "requesterId": "507f1f77bcf86cd799439011",
      "addresseeId": "507f1f77bcf86cd799439012",
      "status": "PENDING",
      "createdAt": "2024-05-24T10:00:00Z"
    }
  }
}
```

### Get Friends List

**Endpoint:** `GET /friends`

**Response:** (200 OK)
```json
{
  "success": true,
  "message": "Friends list retrieved successfully",
  "data": {
    "friends": [
      {
        "_id": "507f1f77bcf86cd799439012",
        "displayName": "Jane Smith",
        "email": "jane@example.com",
        "photoUrl": "https://...",
        "city": "Barcelona",
        "country": "Spain"
      }
    ]
  }
}
```

### Get Pending Requests

**Endpoint:** `GET /friends/pending`

**Response:** (200 OK)
```json
{
  "success": true,
  "message": "Pending requests retrieved successfully",
  "data": {
    "requests": [
      {
        "id": "uuid",
        "requesterId": "507f1f77bcf86cd799439013",
        "addresseeId": "507f1f77bcf86cd799439011",
        "status": "PENDING",
        "createdAt": "2024-05-24T09:00:00Z",
        "requester": {
          "_id": "507f1f77bcf86cd799439013",
          "displayName": "Bob Johnson",
          "email": "bob@example.com",
          "photoUrl": "https://..."
        }
      }
    ]
  }
}
```

### Accept Friend Request

**Endpoint:** `PUT /friends/accept/:friendshipId`

**Response:** (200 OK)
```json
{
  "success": true,
  "message": "Friend request accepted",
  "data": {
    "friendship": { /* updated friendship with status: "ACCEPTED" */ }
  }
}
```

---

## Rankings Module

### Get Weekly Rankings

**Endpoint:** `GET /rankings/weekly/:category?weekNumber=21&year=2024&limit=100`

**Categories:**
- `WEEKLY_STEPS` - Total steps this week
- `WEEKLY_STAMINA` - Total stamina earned this week
- `WEEKLY_SESSIONS` - Number of sessions this week
- `ALL_TIME_STEPS` - Career total steps

**Response:** (200 OK)
```json
{
  "success": true,
  "message": "Rankings retrieved successfully",
  "data": {
    "rankings": [
      {
        "id": "uuid",
        "userId": "507f1f77bcf86cd799439011",
        "category": "WEEKLY_STEPS",
        "score": 45000,
        "weekNumber": 21,
        "year": 2024,
        "rank": 1,
        "user": {
          "_id": "507f1f77bcf86cd799439011",
          "displayName": "John Doe",
          "photoUrl": "https://...",
          "city": "Madrid",
          "country": "Spain"
        }
      }
    ],
    "metadata": {
      "category": "WEEKLY_STEPS",
      "weekNumber": 21,
      "year": 2024
    }
  }
}
```

### Get My Position

**Endpoint:** `GET /rankings/my-position/:category?weekNumber=21&year=2024`

**Response:** (200 OK)
```json
{
  "success": true,
  "message": "User position retrieved successfully",
  "data": {
    "position": 15,
    "score": 28000,
    "category": "WEEKLY_STEPS",
    "weekNumber": 21,
    "year": 2024
  }
}
```

### Get Friends Rankings

**Endpoint:** `GET /rankings/friends/:category`

**Response:** (200 OK)
```json
{
  "success": true,
  "message": "Friends rankings retrieved successfully",
  "data": {
    "rankings": [
      {
        "id": "uuid",
        "userId": "507f1f77bcf86cd799439011",
        "category": "WEEKLY_STEPS",
        "score": 32000,
        "rank": 1,
        "isCurrentUser": true,
        "user": { /* user details */ }
      }
    ],
    "metadata": { /* week info */ }
  }
}
```

---

## Error Responses

All errors follow this format:

```json
{
  "success": false,
  "message": "Error description"
}
```

### Common Status Codes

- `200` - Success
- `201` - Created
- `400` - Bad Request (validation error)
- `401` - Unauthorized (invalid/missing token)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `429` - Too Many Requests (rate limit exceeded)
- `500` - Internal Server Error

### Rate Limits

- General API: 100 requests per 15 minutes
- Auth endpoints: 5 requests per 15 minutes
- Steps submission: 10 requests per minute

---

## Fraud Detection

Steps submissions are automatically analyzed for fraud with a confidence score (0-1):

**Factors Analyzed:**
- Steps per minute (normal: 80-150)
- GPS variance (movement detection)
- Average speed (normal running: 6-15 km/h)
- Steps distribution consistency
- Session duration (suspicious if < 5 min or > 3 hours)

**Thresholds:**
- Valid: >= 0.7
- Suspicious: 0.4 - 0.7
- Blocked: < 0.4

Only "valid" sessions credit stamina to the user.
