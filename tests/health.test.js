const request = require('supertest');
const app = require('../src/app');

describe('Health Check', () => {
  it('should return health status', async () => {
    const res = await request(app).get('/health');

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('status', 'ok');
    expect(res.body).toHaveProperty('timestamp');
    expect(res.body).toHaveProperty('uptime');
    expect(res.body).toHaveProperty('environment');
  });

  it('should return API welcome message on root', async () => {
    const res = await request(app).get('/');

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('message', 'Welcome to Rustep API');
    expect(res.body).toHaveProperty('version');
  });
});
