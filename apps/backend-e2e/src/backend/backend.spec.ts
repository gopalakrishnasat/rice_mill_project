import axios from 'axios';

describe('Backend API End-to-End Suite', () => {
  it('GET /api/setup/status should return system setup status', async () => {
    const res = await axios.get('/api/setup/status');

    expect(res.status).toBe(200);
    expect(res.data.success).toBe(true);
    expect(typeof res.data.data.superAdminExists).toBe('boolean');
  });

  it('POST /api/auth/login should reject invalid credentials with 401', async () => {
    try {
      await axios.post('/api/auth/login', {
        email: 'invalid@ricemill.com',
        password: 'WrongPassword123',
      });
      throw new Error('Should have failed with 401');
    } catch (err: any) {
      expect(err.response?.status).toBe(401);
      expect(err.response?.data?.success).toBe(false);
    }
  });
});
