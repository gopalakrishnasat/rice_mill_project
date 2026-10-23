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

  describe('Role-Based Backend API Restrictions (View-Only Admin)', () => {
    let viewerToken = '';

    beforeAll(async () => {
      const loginRes = await axios.post('/api/auth/login', {
        email: 'viewer@ricemill.com',
        password: 'Viewer@123',
      });
      expect(loginRes.status).toBe(200);
      expect(loginRes.data.success).toBe(true);
      viewerToken = loginRes.data.data.accessToken;
      expect(viewerToken).toBeTruthy();
    });

    const authHeaders = () => ({
      headers: {
        Authorization: `Bearer ${viewerToken}`,
      },
    });

    // 1. Buyers / Customers Restrictions
    it('POST /api/customers should reject View-Only Admin with 403 Forbidden', async () => {
      try {
        await axios.post(
          '/api/customers',
          {
            companyName: 'Unauthorized Traders',
            mobile: '9876543210',
            billingAddress: {
              line1: '123 Market St',
              city: 'Nizamabad',
              state: 'Telangana',
              stateCode: '36',
              pincode: '503001',
            },
          },
          authHeaders(),
        );
        throw new Error('Should have failed with 403');
      } catch (err: any) {
        expect(err.response?.status).toBe(403);
        expect(err.response?.data?.message).toMatch(/Access denied/i);
      }
    });

    it('PUT /api/customers/:id should reject View-Only Admin with 403 Forbidden', async () => {
      try {
        await axios.put(
          '/api/customers/64b1f2e4c9e77a1234567890',
          { companyName: 'Hacked Name' },
          authHeaders(),
        );
        throw new Error('Should have failed with 403');
      } catch (err: any) {
        expect(err.response?.status).toBe(403);
        expect(err.response?.data?.message).toMatch(/Access denied/i);
      }
    });

    it('PATCH /api/customers/:id/status should reject View-Only Admin with 403 Forbidden', async () => {
      try {
        await axios.patch(
          '/api/customers/64b1f2e4c9e77a1234567890/status',
          { isActive: false },
          authHeaders(),
        );
        throw new Error('Should have failed with 403');
      } catch (err: any) {
        expect(err.response?.status).toBe(403);
        expect(err.response?.data?.message).toMatch(/Access denied/i);
      }
    });

    it('GET /api/customers/next-code should reject View-Only Admin with 403 Forbidden', async () => {
      try {
        await axios.get('/api/customers/next-code', authHeaders());
        throw new Error('Should have failed with 403');
      } catch (err: any) {
        expect(err.response?.status).toBe(403);
        expect(err.response?.data?.message).toMatch(/Access denied/i);
      }
    });

    it('GET /api/customers should allow View-Only Admin with 200 OK', async () => {
      const res = await axios.get('/api/customers', authHeaders());
      expect(res.status).toBe(200);
      expect(res.data.success).toBe(true);
      expect(Array.isArray(res.data.data)).toBe(true);
    });

    // 2. GST Invoices Restrictions
    it('POST /api/invoices should reject View-Only Admin with 403 Forbidden', async () => {
      try {
        await axios.post(
          '/api/invoices',
          { invoiceDate: new Date().toISOString() },
          authHeaders(),
        );
        throw new Error('Should have failed with 403');
      } catch (err: any) {
        expect(err.response?.status).toBe(403);
        expect(err.response?.data?.message).toMatch(/Access denied/i);
      }
    });

    it('PUT /api/invoices/:id should reject View-Only Admin with 403 Forbidden', async () => {
      try {
        await axios.put(
          '/api/invoices/64b1f2e4c9e77a1234567890',
          { notes: 'Unauthorized edit' },
          authHeaders(),
        );
        throw new Error('Should have failed with 403');
      } catch (err: any) {
        expect(err.response?.status).toBe(403);
        expect(err.response?.data?.message).toMatch(/Access denied/i);
      }
    });

    it('POST /api/invoices/:id/payments should reject View-Only Admin with 403 Forbidden', async () => {
      try {
        await axios.post(
          '/api/invoices/64b1f2e4c9e77a1234567890/payments',
          { amount: 5000 },
          authHeaders(),
        );
        throw new Error('Should have failed with 403');
      } catch (err: any) {
        expect(err.response?.status).toBe(403);
        expect(err.response?.data?.message).toMatch(/Access denied/i);
      }
    });

    it('POST /api/invoices/customer/:id/allocate-payment should reject View-Only Admin with 403 Forbidden', async () => {
      try {
        await axios.post(
          '/api/invoices/customer/64b1f2e4c9e77a1234567890/allocate-payment',
          { amount: 10000 },
          authHeaders(),
        );
        throw new Error('Should have failed with 403');
      } catch (err: any) {
        expect(err.response?.status).toBe(403);
        expect(err.response?.data?.message).toMatch(/Access denied/i);
      }
    });

    it('GET /api/invoices/next-number should reject View-Only Admin with 403 Forbidden', async () => {
      try {
        await axios.get('/api/invoices/next-number', authHeaders());
        throw new Error('Should have failed with 403');
      } catch (err: any) {
        expect(err.response?.status).toBe(403);
        expect(err.response?.data?.message).toMatch(/Access denied/i);
      }
    });

    it('GET /api/invoices should allow View-Only Admin with 200 OK', async () => {
      const res = await axios.get('/api/invoices', authHeaders());
      expect(res.status).toBe(200);
      expect(res.data.success).toBe(true);
      expect(Array.isArray(res.data.data)).toBe(true);
    });

    // 3. Bill Invoices Restrictions
    it('POST /api/bill-invoices should reject View-Only Admin with 403 Forbidden', async () => {
      try {
        await axios.post(
          '/api/bill-invoices',
          { billDate: new Date().toISOString() },
          authHeaders(),
        );
        throw new Error('Should have failed with 403');
      } catch (err: any) {
        expect(err.response?.status).toBe(403);
        expect(err.response?.data?.message).toMatch(/Access denied/i);
      }
    });

    it('PUT /api/bill-invoices/:id should reject View-Only Admin with 403 Forbidden', async () => {
      try {
        await axios.put(
          '/api/bill-invoices/64b1f2e4c9e77a1234567890',
          { notes: 'Unauthorized edit' },
          authHeaders(),
        );
        throw new Error('Should have failed with 403');
      } catch (err: any) {
        expect(err.response?.status).toBe(403);
        expect(err.response?.data?.message).toMatch(/Access denied/i);
      }
    });

    it('DELETE /api/bill-invoices/:id should reject View-Only Admin with 403 Forbidden', async () => {
      try {
        await axios.delete(
          '/api/bill-invoices/64b1f2e4c9e77a1234567890',
          authHeaders(),
        );
        throw new Error('Should have failed with 403');
      } catch (err: any) {
        expect(err.response?.status).toBe(403);
        expect(err.response?.data?.message).toMatch(/Access denied/i);
      }
    });

    it('GET /api/bill-invoices/next-number should reject View-Only Admin with 403 Forbidden', async () => {
      try {
        await axios.get('/api/bill-invoices/next-number', authHeaders());
        throw new Error('Should have failed with 403');
      } catch (err: any) {
        expect(err.response?.status).toBe(403);
        expect(err.response?.data?.message).toMatch(/Access denied/i);
      }
    });

    it('GET /api/bill-invoices should allow View-Only Admin with 200 OK', async () => {
      const res = await axios.get('/api/bill-invoices', authHeaders());
      expect(res.status).toBe(200);
      expect(res.data.success).toBe(true);
      expect(Array.isArray(res.data.data)).toBe(true);
    });

    // 4. Products Restrictions
    it('POST /api/products should reject View-Only Admin with 403 Forbidden', async () => {
      try {
        await axios.post(
          '/api/products',
          { name: 'New Rice Variety', defaultPricePerUnit: 100 },
          authHeaders(),
        );
        throw new Error('Should have failed with 403');
      } catch (err: any) {
        expect(err.response?.status).toBe(403);
        expect(err.response?.data?.message).toMatch(/Access denied/i);
      }
    });

    it('PUT /api/products/:id should reject View-Only Admin with 403 Forbidden', async () => {
      try {
        await axios.put(
          '/api/products/64b1f2e4c9e77a1234567890',
          { name: 'Updated Variety' },
          authHeaders(),
        );
        throw new Error('Should have failed with 403');
      } catch (err: any) {
        expect(err.response?.status).toBe(403);
        expect(err.response?.data?.message).toMatch(/Access denied/i);
      }
    });

    it('PATCH /api/products/:id/toggle should reject View-Only Admin with 403 Forbidden', async () => {
      try {
        await axios.patch(
          '/api/products/64b1f2e4c9e77a1234567890/toggle',
          {},
          authHeaders(),
        );
        throw new Error('Should have failed with 403');
      } catch (err: any) {
        expect(err.response?.status).toBe(403);
        expect(err.response?.data?.message).toMatch(/Access denied/i);
      }
    });

    it('GET /api/products should allow View-Only Admin with 200 OK', async () => {
      const res = await axios.get('/api/products', authHeaders());
      expect(res.status).toBe(200);
      expect(res.data.success).toBe(true);
      expect(Array.isArray(res.data.data)).toBe(true);
    });

    // 5. User Management & Mill Profile Restrictions
    it('GET /api/users should reject View-Only Admin with 403 Forbidden', async () => {
      try {
        await axios.get('/api/users', authHeaders());
        throw new Error('Should have failed with 403');
      } catch (err: any) {
        expect(err.response?.status).toBe(403);
        expect(err.response?.data?.message).toMatch(/Access denied/i);
      }
    });

    it('PUT /api/company should reject View-Only Admin with 403 Forbidden', async () => {
      try {
        await axios.put(
          '/api/company',
          { millName: 'Unauthorized Mill Rename' },
          authHeaders(),
        );
        throw new Error('Should have failed with 403');
      } catch (err: any) {
        expect(err.response?.status).toBe(403);
        expect(err.response?.data?.message).toMatch(/Access denied/i);
      }
    });

    it('GET /api/company should allow View-Only Admin with 200 OK', async () => {
      const res = await axios.get('/api/company', authHeaders());
      expect(res.status).toBe(200);
      expect(res.data.success).toBe(true);
    });
  });
});
