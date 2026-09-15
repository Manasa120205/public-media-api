// Set test environment configuration
process.env.NODE_ENV = 'test';
process.env.PORT = '3001';
process.env.MEDIA_PROVIDER = 'mock';
process.env.MONTHLY_QUOTA_ENABLED = 'true';
process.env.MONTHLY_DOWNLOAD_LIMIT = '5000';
process.env.API_AUTH_ENABLED = 'false';
process.env.API_KEY = 'test-secret-key-12345';
process.env.REQUEST_TIMEOUT_MS = '500'; // Short timeout for test speed

// Silence test logs unless explicitly requested
process.env.TEST_LOGS = 'false';
