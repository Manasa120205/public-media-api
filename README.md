# PublicMedia API

> A robust, standalone, production-ready REST API backend built in Node.js and Express for analyzing and processing public Instagram media URLs (Reels, posts, images, and public stories) with development quota tracking, multi-tier rate limiting, SSRF protection, pluggable media provider architecture, and zero required paid infrastructure.

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Legal & Technical Compliance Notice](#legal--technical-compliance-notice)
3. [Architecture & Design Principles](#architecture--design-principles)
4. [Project File Structure](#project-file-structure)
5. [Environment Configuration (.env)](#environment-configuration-env)
6. [Quick Start & Local Development](#quick-start--local-development)
7. [API Documentation](#api-documentation)
   - [GET /](#get-)
   - [GET /api/health](#get-apihealth)
   - [POST /api/media/analyze](#post-apimediaanalyze)
   - [POST /api/media/download](#post-apimediadownload)
   - [GET /api/media/quota](#get-apimediaquota)
8. [Standardized Error System](#standardized-error-system)
9. [5,000 Request Monthly Development Quota](#5000-request-monthly-development-quota)
10. [Per-IP Rate Limiting](#per-ip-rate-limiting)
11. [Security & SSRF Mitigation](#security--ssrf-mitigation)
12. [Media Provider Architecture](#media-provider-architecture)
13. [Future Subscription & Plan System](#future-subscription--plan-system)
14. [API Key Authentication](#api-key-authentication)
15. [Automated Testing](#automated-testing)
16. [Free-Tier Deployment Guide](#free-tier-deployment-guide)
17. [Frontend Integration Example](#frontend-integration-example)

---

## Project Overview

**PublicMedia API** is designed from the ground up as an independent, modular developer API. It provides a clean REST interface to validate, analyze, and process publicly accessible Instagram content URLs.

### Core Highlights:
- **No Paid Infrastructure Required**: Runs completely free locally and on free-tier cloud platforms.
- **5,000 Requests/Month Development Quota**: Persisted to disk (`data/quota.json`) so it **survives server restarts** without requiring a database. Automatically resets on the 1st of every calendar month.
- **Pluggable Media Provider Pattern**: Core API controllers are decoupled from the media retrieval mechanism. Includes a built-in offline `MockProvider` for testing without API keys, and an `ExternalProvider` adapter ready for upstream scraping microservices or official Meta APIs.
- **Enterprise-Grade Security**: Helmet headers, configurable CORS, payload size limits (10kb), input sanitization, request timeouts, and comprehensive **Server-Side Request Forgery (SSRF)** protection against internal IP blocks and cloud metadata endpoints.
- **Standardized Errors & Tracing**: Every response includes an `X-Request-Id` UUID, consistent error codes, and structured audit logging that redacts secrets and tokens.

---

## Legal & Technical Compliance Notice

> [!IMPORTANT]
> **Understanding Instagram Media Retrieval Constraints**:
> - **No Direct Public Download API**: Meta does not offer an open, unauthenticated REST API that returns raw MP4/JPEG download URLs for arbitrary public Instagram URLs.
> - **Official Meta APIs**:
>   1. **Instagram oEmbed API**: Officially supported for public posts/reels. Returns author, title, and thumbnail URL. Requires a registered Meta App ID and Client Token.
>   2. **Instagram Graph API**: Only accessible for accounts that have explicitly authenticated via OAuth and granted permissions (e.g. Creator or Business accounts managing their own content).
> - **Private Content & Authentication**: This API **strictly prohibits** and blocks any access to private accounts, direct messages, stories requiring login, or bypasses of CAPTCHA/rate limits.
> - **Provider Decoupling**: Rather than bundling fragile, terms-violating scraping scripts into the web server, PublicMedia API uses an abstracted **Provider Adapter Pattern** (`src/services/mediaProvider.js`). You can route traffic to an authorized microservice, Meta oEmbed, or third-party proxy simply by changing an environment variable.

---

## Architecture & Design Principles

```
  +-------------------------------------------------------------------+
  |                         Client / Frontend                         |
  +-------------------------------------------------------------------+
                                    |
                        HTTP / JSON (Bearer Token / CORS)
                                    v
  +-------------------------------------------------------------------+
  |                       PublicMedia Express API                     |
  |  +--------------------+  +-------------------+  +---------------+  |
  |  |   Helmet & CORS    |  | Rate Limiters (IP)|  | Request ID    |  |
  |  +--------------------+  +-------------------+  +---------------+  |
  |  +--------------------+  +-------------------+  +---------------+  |
  |  | SSRF & URL Guard   |  | Timeout Handler   |  | Auth Guard    |  |
  |  +--------------------+  +-------------------+  +---------------+  |
  +-------------------------------------------------------------------+
                                    |
                    Route Controller & Validation
                                    v
  +-------------------------------------------------------------------+
  |                           MediaService                            |
  |  +-------------------------------------------------------------+  |
  |  |                      Monthly Quota Check                    |  |
  |  |             (survives restarts via data/quota.json)         |  |
  |  +-------------------------------------------------------------+  |
  +-------------------------------------------------------------------+
                                    |
                       Media Provider Abstraction
                                    |
            +-----------------------+-----------------------+
            |                                               |
            v                                               v
+-----------------------+                       +-----------------------+
|     MockProvider      |                       |   ExternalProvider    |
| (Local dev & tests)   |                       | (Upstream Microservice|
| No external network   |                       |  RapidAPI / Meta API) |
+-----------------------+                       +-----------------------+
```

---

## Project File Structure

```
public-media-api/
├── data/
│   ├── .gitkeep                      # Keeps directory in git
│   └── quota.json                    # Auto-generated persistent monthly quota store
├── temp/
│   └── .gitkeep                      # Directory for temporary media processing
├── src/
│   ├── config/
│   │   └── env.js                    # Validated environment configuration with defaults
│   ├── controllers/
│   │   ├── health.controller.js      # / and /api/health controller
│   │   └── media.controller.js       # /api/media analyze, download, and quota controller
│   ├── middleware/
│   │   ├── auth.js                   # Optional API key & Bearer token middleware
│   │   ├── errorHandler.js           # Centralized standardized error & 404 handlers
│   │   ├── quota.js                  # Pre-flight monthly quota enforcement
│   │   ├── rateLimit.js              # Per-IP rate limiting (API, analyze, download)
│   │   ├── timeout.js                # Request timeout watchdog
│   │   └── validation.js             # Request body schema validator
│   ├── routes/
│   │   ├── health.routes.js          # Health check router
│   │   ├── index.js                  # Master route aggregator
│   │   └── media.routes.js           # Media analyze and download router
│   ├── services/
│   │   ├── media.service.js          # Business logic orchestrator
│   │   ├── mediaProvider.js          # Provider registry and manager
│   │   ├── plan.service.js           # Conceptual subscription plans (Free, Pro, etc.)
│   │   ├── quota.service.js          # Atomic file-backed monthly quota tracker
│   │   ├── storage.service.js        # Safe temp file management & auto-cleanup
│   │   └── providers/
│   │       ├── baseProvider.js       # Abstract BaseProvider contract
│   │       ├── externalProvider.js   # Production HTTP adapter for upstream API
│   │       └── mockProvider.js       # Offline development & test provider
│   ├── utils/
│   │   ├── errors.js                 # Standard AppError class & error dictionary
│   │   ├── logger.js                 # Structured JSON logger with token redaction
│   │   ├── requestId.js              # UUID request tracing middleware
│   │   └── urlValidator.js           # URL parser, type detector & SSRF firewall
│   ├── app.js                        # Express app configuration & middleware pipeline
│   └── server.js                     # HTTP server startup & graceful shutdown
├── tests/
│   ├── app.test.js                   # 12-case comprehensive automated test suite
│   └── setup.js                      # Test environment configuration
├── .env.example                      # Template for environment configuration
├── .env                              # Active environment configuration
├── .gitignore                        # Git ignore patterns
├── package.json                      # Dependencies and scripts
├── README.md                         # Complete project documentation
└── vercel.json                       # Vercel serverless deployment configuration
```

---

## Environment Configuration (.env)

Copy `.env.example` to `.env` in the project root:

```bash
cp .env.example .env
```

| Variable | Default | Description |
| :--- | :--- | :--- |
| `PORT` | `3000` | Port for the HTTP server |
| `NODE_ENV` | `development` | `development`, `production`, or `test` |
| `CORS_ORIGIN` | `*` | Allowed CORS origins. In production set to `https://yourdomain.com` |
| `API_AUTH_ENABLED` | `false` | When `true`, requests require Bearer token or `X-API-Key` |
| `API_KEY` | `dev-secret-...` | Secret API key required when auth is enabled |
| `MONTHLY_QUOTA_ENABLED` | `true` | Enables/disables the 5,000 monthly download cap |
| `MONTHLY_DOWNLOAD_LIMIT` | `5000` | Maximum allowed downloads per calendar month |
| `RATE_LIMIT_WINDOW_MS` | `900000` | Rate limiting window in milliseconds (15 min) |
| `API_RATE_LIMIT` | `100` | Max general API calls per IP per window |
| `ANALYZE_RATE_LIMIT` | `60` | Max analyze calls per IP per window |
| `DOWNLOAD_RATE_LIMIT` | `30` | Max download calls per IP per window |
| `REQUEST_TIMEOUT_MS` | `15000` | Request timeout before 504 TIMEOUT (15s) |
| `MEDIA_PROVIDER` | `mock` | Active provider: `mock` (offline dev) or `external` |
| `EXTERNAL_PROVIDER_URL` | *(empty)* | Upstream microservice or RapidAPI endpoint |
| `EXTERNAL_PROVIDER_API_KEY`| *(empty)* | API key for external upstream provider |
| `STORAGE_CLEANUP_INTERVAL_MS`| `300000` | Background cleanup frequency (5 minutes) |
| `STORAGE_FILE_MAX_AGE_MS` | `600000` | Max file age before deletion (10 minutes) |

---

## Quick Start & Local Development

### 1. Requirements
- Node.js version 18+ or 20+ (Node 22 supported)
- npm version 9+

### 2. Install Dependencies
```bash
npm install
```

### 3. Start Development Server (with Auto-Reload)
```bash
npm run dev
```

### 4. Start Production Server
```bash
npm start
```

### 5. Run Automated Tests
```bash
npm test
```

---

## API Documentation

All responses contain a unique `X-Request-Id` header (also included in the JSON body) for request tracing.

### GET /
Returns service identity, version, and running status.

- **URL**: `/`
- **Method**: `GET`
- **Auth**: None
- **Success Response** (200 OK):
  ```json
  {
    "success": true,
    "name": "PublicMedia API",
    "version": "1.0.0",
    "status": "online"
  }
  ```
- **Example curl**:
  ```bash
  curl http://localhost:3000/
  ```

---

### GET /api/health
Returns server health status, uptime in seconds, and current timestamp.

- **URL**: `/api/health`
- **Method**: `GET`
- **Auth**: None
- **Success Response** (200 OK):
  ```json
  {
    "success": true,
    "status": "healthy",
    "uptime": 342,
    "timestamp": "2026-09-15T05:50:00.000Z"
  }
  ```
- **Example curl**:
  ```bash
  curl http://localhost:3000/api/health
  ```

---

### POST /api/media/analyze
Validates an Instagram URL, performs SSRF validation, classifies media type (`reel`, `post`, `story`), and retrieves public metadata.

- **URL**: `/api/media/analyze`
- **Method**: `POST`
- **Headers**: `Content-Type: application/json`
- **Request Body**:
  ```json
  {
    "url": "https://www.instagram.com/reel/C8AbCdEf123/"
  }
  ```
- **Success Response** (200 OK):
  ```json
  {
    "success": true,
    "platform": "instagram",
    "type": "reel",
    "url": "https://www.instagram.com/reel/C8AbCdEf123/",
    "title": "Instagram Reel [C8AbCdEf123]",
    "thumbnail": "https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=640&auto=format&fit=crop&q=80",
    "available": true
  }
  ```
- **Error Response** (400 Bad Request):
  ```json
  {
    "success": false,
    "requestId": "4c944116-bb7e-4b68-b808-ba9e64e101ab",
    "error": {
      "code": "INVALID_URL",
      "message": "URL does not match a supported public Instagram Reel, Post, or Story format."
    }
  }
  ```
- **Example curl**:
  ```bash
  curl -X POST http://localhost:3000/api/media/analyze \
    -H "Content-Type: application/json" \
    -d '{"url":"https://www.instagram.com/reel/C8AbCdEf123/"}'
  ```

---

### POST /api/media/download
Enforces monthly development quota and rate limits, validates accessibility, and returns an authorized temporary media download link.

- **URL**: `/api/media/download`
- **Method**: `POST`
- **Headers**: `Content-Type: application/json`
- **Request Body**:
  ```json
  {
    "url": "https://www.instagram.com/reel/C8AbCdEf123/"
  }
  ```
- **Success Response** (200 OK):
  ```json
  {
    "success": true,
    "requestId": "b3e94711-2b0e-4de2-9844-933333333333",
    "platform": "instagram",
    "type": "reel",
    "downloadUrl": "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
    "expiresAt": "2026-09-15T06:50:00.000Z",
    "quota": {
      "limit": 5000,
      "used": 1,
      "remaining": 4999,
      "resetAt": "2026-10-01T00:00:00.000Z"
    }
  }
  ```
- **Error Response** (429 Quota Exceeded):
  ```json
  {
    "success": false,
    "requestId": "b3e94711-2b0e-4de2-9844-933333333333",
    "error": {
      "code": "MONTHLY_LIMIT_REACHED",
      "message": "Monthly development download limit reached."
    }
  }
  ```
- **Example curl**:
  ```bash
  curl -X POST http://localhost:3000/api/media/download \
    -H "Content-Type: application/json" \
    -d '{"url":"https://www.instagram.com/reel/C8AbCdEf123/"}'
  ```

---

### GET /api/media/quota
Queries the current monthly development quota status without consuming a download credit.

- **URL**: `/api/media/quota`
- **Method**: `GET`
- **Success Response** (200 OK):
  ```json
  {
    "success": true,
    "requestId": "7e366ad4-bc83-4929-a1b7-a37a1f5f3e9a",
    "quota": {
      "limit": 5000,
      "used": 1,
      "remaining": 4999,
      "totalRequests": 1,
      "successfulRequests": 1,
      "failedRequests": 0,
      "resetAt": "2026-10-01T00:00:00.000Z",
      "enabled": true
    }
  }
  ```
- **Example curl**:
  ```bash
  curl http://localhost:3000/api/media/quota
  ```

---

## Standardized Error System

All errors follow a unified JSON envelope with HTTP status codes:

```json
{
  "success": false,
  "requestId": "4c944116-bb7e-4b68-b808-ba9e64e101ab",
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable description."
  }
}
```

| Code | HTTP | Description |
| :--- | :--- | :--- |
| `INVALID_URL` | 400 | URL is missing, malformed, or has invalid shortcode structure |
| `UNSUPPORTED_DOMAIN`| 400 | Non-Instagram domain or dangerous internal/loopback host (SSRF) |
| `PRIVATE_CONTENT` | 403 | Direct messages, account settings, or private accounts |
| `MEDIA_NOT_FOUND` | 404 | Post/Reel identifier does not exist or was removed |
| `MEDIA_UNAVAILABLE` | 404 | Public media metadata could not be retrieved |
| `DOWNLOAD_UNAVAILABLE`| 503 | Stream or download URL is not available from provider |
| `MONTHLY_LIMIT_REACHED`| 429 | Development quota for the current calendar month reached |
| `RATE_LIMITED` | 429 | IP made too many requests within the 15-minute window |
| `AUTH_REQUIRED` | 401 | Missing or invalid API key when `API_AUTH_ENABLED=true` |
| `PROVIDER_ERROR` | 502 | Upstream media service returned an unhandled error |
| `TIMEOUT` | 504 | Media processing exceeded `REQUEST_TIMEOUT_MS` (15s) |
| `INTERNAL_ERROR` | 500 | Unhandled server error (stack traces hidden in production) |

---

## 5,000 Request Monthly Development Quota

- **Target**: 5,000 download requests per calendar month.
- **Persistence without Paid Database**:
  - Automatically writes state to `data/quota.json` atomically (`temp file -> fs.renameSync`).
  - Survives server restarts, power cycles, and local reboot.
- **Month Rollover**:
  - Compares UTC `YYYY-MM`.
  - When the 1st day of a new month arrives, usage counters automatically reset to 0, and `resetAt` is recalculated for the next month.
- **Failed Requests**: Failed downloads do not consume quota credits.

---

## Per-IP Rate Limiting

Separate rate limiters protect the service using `express-rate-limit`:

| Protection Scope | Default Limit | Window | Header |
| :--- | :--- | :--- | :--- |
| Global API (`/api/media/*`) | 100 requests | 15 min | `RateLimit-Limit: 100` |
| Analyze (`/api/media/analyze`) | 60 requests | 15 min | `RateLimit-Limit: 60` |
| Download (`/api/media/download`) | 30 requests | 15 min | `RateLimit-Limit: 30` |

If an IP exceeds its limit, the API immediately responds with HTTP 429 and `RATE_LIMITED`.

---

## Security & SSRF Mitigation

1. **SSRF Guard (`src/utils/urlValidator.js`)**:
   - Rejects non-HTTP/HTTPS schemes.
   - Restricts domains strictly to `instagram.com`, `www.instagram.com`, and `instagr.am`.
   - Actively checks for and blocks private IPv4 and IPv6 address spaces:
     - `127.0.0.0/8` (Loopback)
     - `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16` (Private RFC1918)
     - `169.254.0.0/16` & `169.254.169.254` (Cloud Metadata endpoints)
     - `::1`, `fc00::/7`, `fe80::/10` (IPv6 loopback & link-local)
     - Internal domains like `metadata.google.internal` and `.local`
2. **Helmet**: Protects against clickjacking, MIME sniffing, and cross-site scripting.
3. **Payload Control**: Limits JSON body size to `10kb` to prevent memory denial-of-service.
4. **Secret Scrubbing**: The structured logger recursively redacts keys matching passwords, tokens, API keys, and cookies.

---

## Media Provider Architecture

The API controller never communicates directly with Instagram. It calls `MediaService`, which talks to the registered `BaseProvider`.

### 1. `MockProvider` (Default)
- Runs completely offline without any internet connection or API keys.
- Accurately parses URLs, produces structured responses, and generates mock download URLs.
- Perfect for local UI development, QA testing, and CI/CD pipelines.

### 2. `ExternalProvider` Adapter
- Switch by setting `MEDIA_PROVIDER=external` in `.env`.
- For production, point `EXTERNAL_PROVIDER_URL` and `EXTERNAL_PROVIDER_API_KEY` to your upstream proxy microservice, RapidAPI Instagram service, or Meta oEmbed provider.
- Handles upstream connection timeouts, HTTP status mapping, and JSON response normalization.

---

## Future Subscription & Plan System

Located in [`src/services/plan.service.js`](file:///c:/API/src/services/plan.service.js).

Designed to enable seamless integration with user accounts and Stripe/Razorpay billing:

| Plan | Monthly Downloads | Target Price |
| :--- | :--- | :--- |
| **FREE** | 50 downloads | $0 / Free |
| **BASIC** | 1,000 downloads | To be configured |
| **PRO** | 5,000 downloads | To be configured |
| **PREMIUM** | 25,000 downloads | To be configured |

### Available Interface Methods:
- `getUserPlan(userId)`: Resolves the active subscription plan.
- `getPlanLimit(planId)`: Returns the numeric monthly download limit.
- `getUsage(userId)`: Fetches current consumption and remaining credits.
- `incrementUsage(userId)`: Safely charges 1 credit against user account.

---

## API Key Authentication

To restrict access to authorized clients:
1. Set `API_AUTH_ENABLED=true` in `.env`.
2. Set your secret `API_KEY=your-strong-random-key`.
3. Pass the key in requests using either:
   - Header: `Authorization: Bearer <API_KEY>`
   - Header: `X-API-Key: <API_KEY>`

---

## Automated Testing

The project includes an automated test suite verifying all 12 core requirements:

```bash
npm test
```

### Covered Test Scenarios:
1. `GET /` root info and status
2. `GET /api/health` health status, uptime, and timestamp
3. Valid Instagram Reel/Post URL analysis and download
4. Missing, empty, or malformed URL handling (`INVALID_URL`)
5. Non-Instagram domain rejection (`UNSUPPORTED_DOMAIN`)
6. Direct message and private URL rejection (`PRIVATE_CONTENT`)
7. Monthly download quota exhaustion handling (`MONTHLY_LIMIT_REACHED`)
8. Per-IP rate limiting enforcement (`RATE_LIMITED`)
9. API key and Bearer token authentication enforcement (`AUTH_REQUIRED`)
10. Downstream media provider failure handling (`PROVIDER_ERROR`)
11. Request timeout enforcement (`TIMEOUT`)
12. Comprehensive SSRF attack prevention (localhost, private subnets, cloud metadata)

---

## Free-Tier Deployment Guide

### Option 1: Render (Recommended for Free Persistent Disk)
- **Plan**: Render Free Web Service
- **Persistent Quota**: `data/quota.json` survives restarts on disk (or persists as long as instance runs; month rollover works reliably).
- **HTTPS**: Automatic free SSL certificate.
- **Setup**:
  1. Push code to GitHub/GitLab.
  2. Create a new "Web Service" on [render.com](https://render.com).
  3. Build Command: `npm install`
  4. Start Command: `npm start`
  5. Add Environment Variables from `.env.example`.

### Option 2: Vercel (Serverless Free Tier)
- **Plan**: Vercel Hobby Free Tier.
- **Config**: Already included via [`vercel.json`](file:///c:/API/vercel.json).
- **Serverless Quota Note**: Vercel functions are stateless and ephemeral (disk is read-only outside `/tmp`). For persistent quotas on Vercel without paid databases, pair with the **Upstash Redis Free Tier** (10,000 commands/day free).

### Bandwidth & Traffic Budget for 5,000 Downloads:
- 5,000 Reels @ ~10MB each = **~50 GB bandwidth/month**.
- If providing direct temporary authorized URLs (redirecting the client to download directly from the CDN), **server bandwidth consumed is practically 0 GB** because only metadata JSON passes through your API!

---

## Frontend Integration Example

Here is an example demonstrating how a frontend application can call PublicMedia API to display loading states, media thumbnails, download buttons, error alerts, and remaining quota:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>PublicMedia API - Frontend Demo</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; max-width: 600px; margin: 40px auto; padding: 0 20px; }
    input { width: 100%; padding: 12px; font-size: 15px; border: 1px solid #ccc; border-radius: 6px; box-sizing: border-box; }
    .btn-group { display: flex; gap: 10px; margin-top: 12px; }
    button { flex: 1; padding: 12px; font-size: 15px; font-weight: 600; cursor: pointer; border-radius: 6px; border: none; background: #0095f6; color: white; }
    button:disabled { background: #b2dffc; cursor: not-allowed; }
    .card { margin-top: 24px; padding: 20px; border: 1px solid #e1e1e1; border-radius: 8px; }
    .thumbnail { width: 100%; max-height: 350px; object-fit: cover; border-radius: 6px; }
    .error { background: #ffebee; color: #c62828; padding: 12px; border-radius: 6px; margin-top: 16px; }
    .quota-badge { display: inline-block; background: #e8f5e9; color: #2e7d32; padding: 6px 12px; border-radius: 12px; font-size: 13px; margin-top: 10px; }
  </style>
</head>
<body>
  <h2>PublicMedia API Client</h2>
  
  <input type="text" id="urlInput" placeholder="Paste public Instagram Reel or Post URL..." value="https://www.instagram.com/reel/C8AbCdEf123/" />

  <div class="btn-group">
    <button id="analyzeBtn" onclick="handleAnalyze()">Analyze Media</button>
    <button id="downloadBtn" onclick="handleDownload()">Download Media</button>
  </div>

  <div id="loading" style="display:none; margin-top: 16px;">Processing request, please wait...</div>
  <div id="errorMessage" class="error" style="display:none;"></div>

  <div id="resultCard" class="card" style="display:none;">
    <h3 id="mediaTitle"></h3>
    <img id="mediaThumbnail" class="thumbnail" alt="Thumbnail" />
    <div style="margin-top: 15px;">
      <a id="downloadLink" href="#" target="_blank">
        <button style="background: #28a745;">Direct Download</button>
      </a>
    </div>
    <div id="quotaBadge" class="quota-badge"></div>
  </div>

  <script>
    const API_BASE = 'http://localhost:3000';

    async function fetchRemainingQuota() {
      try {
        const res = await fetch(`${API_BASE}/api/media/quota`);
        const data = await res.json();
        if (data.success && data.quota) {
          updateQuotaDisplay(data.quota);
        }
      } catch (err) {
        console.warn('Could not fetch quota', err);
      }
    }

    function updateQuotaDisplay(quota) {
      const badge = document.getElementById('quotaBadge');
      badge.innerText = `Monthly Quota: ${quota.remaining} / ${quota.limit} remaining (Resets: ${new Date(quota.resetAt).toLocaleDateString()})`;
    }

    function resetUI() {
      document.getElementById('loading').style.display = 'block';
      document.getElementById('errorMessage').style.display = 'none';
      document.getElementById('resultCard').style.display = 'none';
    }

    function showError(message) {
      document.getElementById('loading').style.display = 'none';
      const errBox = document.getElementById('errorMessage');
      errBox.innerText = message;
      errBox.style.display = 'block';
    }

    async function handleAnalyze() {
      resetUI();
      const url = document.getElementById('urlInput').value;

      try {
        const res = await fetch(`${API_BASE}/api/media/analyze`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url })
        });
        const data = await res.json();
        document.getElementById('loading').style.display = 'none';

        if (!data.success) {
          showError(`[${data.error.code}] ${data.error.message}`);
          return;
        }

        document.getElementById('mediaTitle').innerText = data.title;
        document.getElementById('mediaThumbnail').src = data.thumbnail;
        document.getElementById('downloadLink').style.display = 'none';
        document.getElementById('resultCard').style.display = 'block';
        fetchRemainingQuota();
      } catch (err) {
        showError('Network error connecting to PublicMedia API.');
      }
    }

    async function handleDownload() {
      resetUI();
      const url = document.getElementById('urlInput').value;

      try {
        const res = await fetch(`${API_BASE}/api/media/download`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url })
        });
        const data = await res.json();
        document.getElementById('loading').style.display = 'none';

        if (!data.success) {
          showError(`[${data.error.code}] ${data.error.message}`);
          return;
        }

        document.getElementById('mediaTitle').innerText = `Ready to download (${data.type.toUpperCase()})`;
        document.getElementById('downloadLink').href = data.downloadUrl;
        document.getElementById('downloadLink').style.display = 'inline-block';
        document.getElementById('resultCard').style.display = 'block';

        if (data.quota) {
          updateQuotaDisplay(data.quota);
        }
      } catch (err) {
        showError('Network error connecting to PublicMedia API.');
      }
    }

    // Load initial quota on page load
    fetchRemainingQuota();
  </script>
</body>
</html>
```

---

## License

MIT
