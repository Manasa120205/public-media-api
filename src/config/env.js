const path = require('path');
const dotenv = require('dotenv');

// Load environment variables from .env file
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  isProduction: process.env.NODE_ENV === 'production',
  isTest: process.env.NODE_ENV === 'test',

  // CORS Settings
  corsOrigin: process.env.CORS_ORIGIN || '*',

  // Optional Authentication
  apiAuthEnabled: process.env.API_AUTH_ENABLED === 'true',
  apiKey: process.env.API_KEY || 'dev-secret-api-key-replace-in-production',

  // Monthly Quota Configuration
  monthlyQuotaEnabled: process.env.MONTHLY_QUOTA_ENABLED !== 'false',
  monthlyDownloadLimit: parseInt(process.env.MONTHLY_DOWNLOAD_LIMIT || '5000', 10),

  // Rate Limiting (per IP)
  rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 minutes
  apiRateLimit: parseInt(process.env.API_RATE_LIMIT || '100', 10),
  analyzeRateLimit: parseInt(process.env.ANALYZE_RATE_LIMIT || '60', 10),
  downloadRateLimit: parseInt(process.env.DOWNLOAD_RATE_LIMIT || '30', 10),

  // Timeout
  requestTimeoutMs: parseInt(process.env.REQUEST_TIMEOUT_MS || '15000', 10),

  // Media Provider ("mock" or "external")
  mediaProvider: process.env.MEDIA_PROVIDER || 'mock',
  externalProviderUrl: process.env.EXTERNAL_PROVIDER_URL || '',
  externalProviderApiKey: process.env.EXTERNAL_PROVIDER_API_KEY || '',

  // Optional Meta credentials
  instagramApiKey: process.env.INSTAGRAM_API_KEY || '',
  instagramAccessToken: process.env.INSTAGRAM_ACCESS_TOKEN || '',

  // RapidAPI Fallback Provider Credentials
  rapidApiKey: process.env.RAPIDAPI_KEY || '3e816048ffmshd860f2873aa16f2p127184jsnfb7a9ceab949',
  rapidApiHost: process.env.RAPIDAPI_HOST || 'instagram-downloader-v2-scraper-reels-igtv-posts-stories.p.rapidapi.com',

  // Storage
  tempStorageDir: path.resolve(process.cwd(), process.env.TEMP_STORAGE_DIR || './temp'),
  dataStorageDir: path.resolve(process.cwd(), process.env.DATA_STORAGE_DIR || './data'),
  storageCleanupIntervalMs: parseInt(process.env.STORAGE_CLEANUP_INTERVAL_MS || '300000', 10),
  storageFileMaxAgeMs: parseInt(process.env.STORAGE_FILE_MAX_AGE_MS || '600000', 10)
};

module.exports = config;
