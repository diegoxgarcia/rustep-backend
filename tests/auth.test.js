const request = require('supertest');
const app = require('../src/app');

describe('Auth Endpoints', () => {
  describe('POST /api/v1/auth/google', () => {
    it('should return 400 if idToken is missing', async () => {
      const res = await request(app)
        .post('/api/v1/auth/google')
        .send({});

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should return 401 for invalid idToken', async () => {
      const res = await request(app)
        .post('/api/v1/auth/google')
        .send({ idToken: 'invalid-token' });

      expect(res.statusCode).toBe(401);
    });
  });

  describe('GET /api/v1/auth/me', () => {
    it('should return 401 if no token provided', async () => {
      const res = await request(app)
        .get('/api/v1/auth/me');

      expect(res.statusCode).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should return 401 for invalid token', async () => {
      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', 'Bearer invalid-token');

      expect(res.statusCode).toBe(401);
    });
  });
});
