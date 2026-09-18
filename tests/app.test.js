const request = require('supertest');
const app = require('../src/app');
const config = require('../src/config/env');
const quotaService = require('../src/services/quota.service');

describe('PublicMedia API Test Suite', () => {
  beforeEach(() => {
    // Reset configuration defaults before each test
    config.apiAuthEnabled = false;
    quotaService.resetQuota(5000);
  });

  afterAll(() => {
    // Clean up any remaining quota state
    quotaService.resetQuota(5000);
  });

  // ==========================================================================
  // 1. GET /
  // ==========================================================================
  describe('1. GET / (Root Endpoint)', () => {
    it('should return server status and metadata with HTTP 200', async () => {
      const res = await request(app).get('/');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        success: true,
        name: 'PublicMedia API',
        version: '1.0.0',
        status: 'online'
      });
      expect(res.headers['x-request-id']).toBeDefined();
    });
  });

  // ==========================================================================
  // 2. GET /api/health
  // ==========================================================================
  describe('2. GET /api/health (Health Endpoint)', () => {
    it('should return healthy status, uptime, version, and timestamp', async () => {
      const res = await request(app).get('/api/health');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.status).toBe('healthy');
      expect(res.body.version).toBe('1.0.0');
      expect(typeof res.body.uptime).toBe('number');
      expect(typeof res.body.timestamp).toBe('string');
      expect(new Date(res.body.timestamp).getTime()).not.toBeNaN();
    });
  });

  // ==========================================================================
  // 3. Valid Instagram URL (Analyze & Download)
  // ==========================================================================
  describe('3. Valid Instagram URL', () => {
    const validReelUrl = 'https://www.instagram.com/reel/C8AbCdEf123/';

    it('POST /api/media/analyze should return valid structured metadata', async () => {
      const res = await request(app)
        .post('/api/media/analyze')
        .send({ url: validReelUrl });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.platform).toBe('instagram');
      expect(res.body.type).toBe('reel');
      expect(res.body.url).toBe(validReelUrl);
      expect(res.body.title).toContain('Reel');
      expect(res.body.creator).toBeDefined();
      expect(res.body.hasAudio).toBe(true);
      expect(res.body.available).toBe(true);
    });

    it('POST /api/media/download should return downloadUrl and quota status', async () => {
      const res = await request(app)
        .post('/api/media/download')
        .send({ url: validReelUrl });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.requestId).toBeDefined();
      expect(res.body.platform).toBe('instagram');
      expect(res.body.type).toBe('reel');
      expect(res.body.creator).toBeDefined();
      expect(res.body.hasAudio).toBe(true);
      expect(res.body.filename).toContain('instagram_reel_');
      expect(res.body.downloadUrl).toBeDefined();
      expect(res.body.expiresAt).toBeDefined();
      expect(res.body.quota).toBeDefined();
      expect(res.body.quota.limit).toBe(5000);
      expect(res.body.quota.used).toBeGreaterThanOrEqual(1);
    });
  });

  // ==========================================================================
  // 4. Invalid URL
  // ==========================================================================
  describe('4. Invalid URL', () => {
    it('should return 400 INVALID_URL when url is missing or empty', async () => {
      const res = await request(app)
        .post('/api/media/analyze')
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.requestId).toBeDefined();
      expect(res.body.error.code).toBe('INVALID_URL');
    });

    it('should return 400 INVALID_URL when url is malformed string', async () => {
      const res = await request(app)
        .post('/api/media/analyze')
        .send({ url: 'not-a-valid-http-url' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('INVALID_URL');
    });

    it('should return 400 INVALID_URL when Instagram shortcode is missing', async () => {
      const res = await request(app)
        .post('/api/media/analyze')
        .send({ url: 'https://www.instagram.com/reel/' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('INVALID_URL');
    });
  });

  // ==========================================================================
  // 5. Unsupported Domain
  // ==========================================================================
  describe('5. Unsupported Domain', () => {
    it('should return 400 UNSUPPORTED_DOMAIN for non-Instagram domains', async () => {
      const res = await request(app)
        .post('/api/media/analyze')
        .send({ url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.requestId).toBeDefined();
      expect(res.body.error.code).toBe('UNSUPPORTED_DOMAIN');
      expect(res.body.error.message).toContain('not supported');
    });
  });

  // ==========================================================================
  // 6. Private Content
  // ==========================================================================
  describe('6. Private Content Rejection', () => {
    it('should return 403 PRIVATE_CONTENT for direct message URLs', async () => {
      const res = await request(app)
        .post('/api/media/analyze')
        .send({ url: 'https://www.instagram.com/direct/t/17841400000000000/' });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('PRIVATE_CONTENT');
    });

    it('should return 403 PRIVATE_CONTENT for simulated private flags', async () => {
      const res = await request(app)
        .post('/api/media/download')
        .send({ url: 'https://www.instagram.com/p/C7xYz123_private/' });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('PRIVATE_CONTENT');
    });
  });

  // ==========================================================================
  // 7. Monthly Quota Exceeded
  // ==========================================================================
  describe('7. Monthly Quota Exceeded', () => {
    it('should return 429 MONTHLY_LIMIT_REACHED when quota is depleted', async () => {
      // Set limit to 0 to simulate exhausted monthly limit
      quotaService.resetQuota(0);

      const res = await request(app)
        .post('/api/media/download')
        .send({ url: 'https://www.instagram.com/reel/C8AbCdEf123/' });

      expect(res.status).toBe(429);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('MONTHLY_LIMIT_REACHED');
      expect(res.body.error.message).toBe('Monthly development download limit reached.');
    });
  });

  // ==========================================================================
  // 8. Rate Limit Exceeded
  // ==========================================================================
  describe('8. Rate Limiting per IP', () => {
    it('should return 429 RATE_LIMITED when threshold is exceeded', async () => {
      const express = require('express');
      const { rateLimit } = require('express-rate-limit');
      const { createRateLimitHandler } = require('../src/middleware/rateLimit');

      // Create an isolated sub-app with low max limit to test rate limiting precisely
      const testApp = express();
      testApp.use(express.json());
      testApp.use(
        '/rate-test',
        rateLimit({
          windowMs: 60000,
          max: 2,
          handler: createRateLimitHandler('Rate limit exceeded')
        }),
        (req, res) => res.json({ ok: true })
      );

      // Request 1: OK
      const res1 = await request(testApp).get('/rate-test');
      expect(res1.status).toBe(200);

      // Request 2: OK
      const res2 = await request(testApp).get('/rate-test');
      expect(res2.status).toBe(200);

      // Request 3: Blocked by rate limiter
      const res3 = await request(testApp).get('/rate-test');
      expect(res3.status).toBe(429);
      expect(res3.body.success).toBe(false);
      expect(res3.body.error.code).toBe('RATE_LIMITED');
    });
  });

  // ==========================================================================
  // 9. Missing Authentication when Enabled
  // ==========================================================================
  describe('9. API Key Authentication', () => {
    beforeEach(() => {
      config.apiAuthEnabled = true;
      config.apiKey = 'test-secret-key-12345';
    });

    afterEach(() => {
      config.apiAuthEnabled = false;
    });

    it('should return 401 AUTH_REQUIRED when authentication header is missing', async () => {
      const res = await request(app)
        .post('/api/media/analyze')
        .send({ url: 'https://www.instagram.com/reel/C8AbCdEf123/' });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('AUTH_REQUIRED');
    });

    it('should return 401 AUTH_REQUIRED when invalid token is provided', async () => {
      const res = await request(app)
        .post('/api/media/analyze')
        .set('Authorization', 'Bearer wrong-token')
        .send({ url: 'https://www.instagram.com/reel/C8AbCdEf123/' });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('AUTH_REQUIRED');
    });

    it('should succeed with 200 when valid Bearer token is provided', async () => {
      const res = await request(app)
        .post('/api/media/analyze')
        .set('Authorization', 'Bearer test-secret-key-12345')
        .send({ url: 'https://www.instagram.com/reel/C8AbCdEf123/' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should succeed with 200 when valid X-API-Key header is provided', async () => {
      const res = await request(app)
        .post('/api/media/analyze')
        .set('X-API-Key', 'test-secret-key-12345')
        .send({ url: 'https://www.instagram.com/reel/C8AbCdEf123/' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  // ==========================================================================
  // 10. Provider Failure
  // ==========================================================================
  describe('10. Provider Failure', () => {
    it('should return 502 PROVIDER_ERROR when downstream provider fails', async () => {
      const res = await request(app)
        .post('/api/media/analyze')
        .send({ url: 'https://www.instagram.com/reel/fail_provider_test/' });

      expect(res.status).toBe(502);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('PROVIDER_ERROR');
    });
  });

  // ==========================================================================
  // 11. Request Timeout
  // ==========================================================================
  describe('11. Request Timeout', () => {
    it('should return 504 TIMEOUT when media operation exceeds time limit', async () => {
      const res = await request(app)
        .post('/api/media/analyze')
        .send({ url: 'https://www.instagram.com/reel/timeout_test_123/' });

      expect(res.status).toBe(504);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('TIMEOUT');
    });
  });

  // ==========================================================================
  // 12. SSRF Attempt Prevention
  // ==========================================================================
  describe('12. SSRF Protection', () => {
    it('should block localhost attempts', async () => {
      const res = await request(app)
        .post('/api/media/analyze')
        .send({ url: 'http://localhost/reel/123/' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNSUPPORTED_DOMAIN');
    });

    it('should block loopback IP 127.0.0.1', async () => {
      const res = await request(app)
        .post('/api/media/analyze')
        .send({ url: 'http://127.0.0.1/reel/123/' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('UNSUPPORTED_DOMAIN');
    });

    it('should block AWS/GCP Cloud Metadata IP 169.254.169.254', async () => {
      const res = await request(app)
        .post('/api/media/analyze')
        .send({ url: 'http://169.254.169.254/latest/meta-data/' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('UNSUPPORTED_DOMAIN');
    });

    it('should block private Class C subnet 192.168.1.1', async () => {
      const res = await request(app)
        .post('/api/media/analyze')
        .send({ url: 'http://192.168.1.1/admin/' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('UNSUPPORTED_DOMAIN');
    });

    it('should block internal domain names', async () => {
      const res = await request(app)
        .post('/api/media/analyze')
        .send({ url: 'http://metadata.google.internal/computeMetadata/v1/' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('UNSUPPORTED_DOMAIN');
    });
  });

  // ==========================================================================
  // 13. Interactive Browser Demo Serving
  // ==========================================================================
  describe('13. Interactive Browser Demo Console', () => {
    it('GET /demo/ should serve static HTML console', async () => {
      const res = await request(app).get('/demo/');

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/html');
      expect(res.text).toContain('PublicMedia API');
    });
  });

  // ==========================================================================
  // ==========================================================================
  // 14. Multi-Key & Subscription Plans
  // ==========================================================================
  describe('14. Multi-Key & Subscription Plans', () => {
    const planService = require('../src/services/plan.service');

    it('should correctly resolve plan limits for Free, Basic, Pro, and Business', () => {
      expect(planService.getPlanLimit('free')).toBe(100);
      expect(planService.getPlanLimit('basic')).toBe(1000);
      expect(planService.getPlanLimit('pro')).toBe(5000);
      expect(planService.getPlanLimit('business')).toBe(25000);
      expect(planService.getPlanLimit('premium')).toBe(25000);
    });

    it('should dynamically generate and register new user API keys', () => {
      const newKey = planService.createApiKey('client_tenant_1', 'basic');

      expect(newKey.key.startsWith('pk_')).toBe(true);
      expect(newKey.plan).toBe('basic');
      expect(newKey.userId).toBe('client_tenant_1');

      const info = planService.getKeyInfo(newKey.key);
      expect(info).toBeDefined();
      expect(info.plan).toBe('basic');
    });
  });

  // ==========================================================================
  // 15. GET /api/quota
  // ==========================================================================
  describe('15. GET /api/quota (Standard Quota Endpoint)', () => {
    it('should return 200 with standard persistent quota information', async () => {
      const res = await request(app).get('/api/quota').set('Accept', 'application/json');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.quota).toBeDefined();
      expect(res.body.quota.limit).toBe(5000);
      expect(typeof res.body.quota.used).toBe('number');
      expect(typeof res.body.quota.remaining).toBe('number');
      expect(typeof res.body.quota.percentageUsed).toBe('number');
      expect(typeof res.body.quota.month).toBe('string');
      expect(res.body.quota.month).toMatch(/^\d{4}-\d{2}$/);
      expect(res.body.quota.resetAt).toBeDefined();
    });
  });

  // ==========================================================================
  // 16. GET /docs & OpenAPI Specification
  // ==========================================================================
  describe('16. OpenAPI Documentation (/docs)', () => {
    it('GET /docs should return interactive Swagger UI documentation', async () => {
      const res = await request(app).get('/docs');

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/html');
      expect(res.text).toContain('SwaggerUIBundle');
      expect(res.text).toContain('/api/docs/openapi.json');
    });

    it('GET /api/docs/openapi.json should return valid OpenAPI 3.0 specification', async () => {
      const res = await request(app).get('/api/docs/openapi.json');

      expect(res.status).toBe(200);
      expect(res.body.openapi).toBe('3.0.3');
      expect(res.body.info.title).toBe('PublicMedia API');
      expect(res.body.paths['/api/media/analyze']).toBeDefined();
      expect(res.body.paths['/api/media/download']).toBeDefined();
      expect(res.body.paths['/api/quota']).toBeDefined();
      expect(res.body.paths['/api/health']).toBeDefined();
    });
  });
});

