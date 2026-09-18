/**
 * Interactive OpenAPI 3.0 Documentation Controller
 */

const getOpenApiSpec = (req, res) => {
  const protocol = req.protocol || 'http';
  const host = req.get('host') || 'localhost:3000';
  const serverUrl = `${protocol}://${host}`;

  const spec = {
    openapi: '3.0.3',
    info: {
      title: 'PublicMedia API',
      version: '1.0.0',
      description: 'High-performance, standalone public Instagram media API supporting Reels, Posts, Stories, and Audio extraction with 5,000 monthly quota and multi-tier subscription keys.',
      contact: {
        name: 'API Support',
        email: 'info@steal.com'
      }
    },
    servers: [
      {
        url: serverUrl,
        description: 'Current Environment'
      },
      {
        url: 'https://public-media-api.onrender.com',
        description: 'Render Production (Docker Web Service)'
      }
    ],
    components: {
      securitySchemes: {
        ApiKeyAuth: {
          type: 'apiKey',
          in: 'header',
          name: 'X-API-Key',
          description: 'API key authentication via X-API-Key header (when API_AUTH_ENABLED=true)'
        },
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'API-Key',
          description: 'API key authentication via Authorization: Bearer <key> header'
        }
      },
      schemas: {
        HealthResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            status: { type: 'string', example: 'healthy' },
            uptime: { type: 'integer', example: 1420 },
            timestamp: { type: 'string', format: 'date-time', example: '2026-09-18T10:30:00.000Z' },
            version: { type: 'string', example: '1.0.0' }
          }
        },
        QuotaStatus: {
          type: 'object',
          properties: {
            limit: { type: 'integer', example: 5000, description: 'Total monthly download allocation' },
            used: { type: 'integer', example: 42, description: 'Number of successful downloads in calendar month' },
            remaining: { type: 'integer', example: 4958, description: 'Downloads remaining until month rollover' },
            percentageUsed: { type: 'number', example: 0.84, description: 'Percentage of monthly quota consumed' },
            month: { type: 'string', example: '2026-09', description: 'Active calendar month (YYYY-MM)' },
            resetAt: { type: 'string', format: 'date-time', example: '2026-10-01T00:00:00.000Z', description: 'UTC timestamp of next quota reset' }
          }
        },
        QuotaResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            quota: { $ref: '#/components/schemas/QuotaStatus' }
          }
        },
        AnalyzeRequest: {
          type: 'object',
          required: ['url'],
          properties: {
            url: {
              type: 'string',
              format: 'uri',
              example: 'https://www.instagram.com/reel/C8AbCdEf123/',
              description: 'Public Instagram Reel, Post, or Story URL'
            }
          }
        },
        AnalyzeResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            platform: { type: 'string', example: 'instagram' },
            type: { type: 'string', enum: ['reel', 'post', 'story'], example: 'reel' },
            creator: { type: 'string', example: '@username', nullable: true },
            hasAudio: { type: 'boolean', example: true },
            url: { type: 'string', example: 'https://www.instagram.com/reel/C8AbCdEf123/' },
            title: { type: 'string', example: 'Instagram Reel' },
            thumbnail: { type: 'string', nullable: true },
            available: { type: 'boolean', example: true }
          }
        },
        DownloadRequest: {
          type: 'object',
          required: ['url'],
          properties: {
            url: {
              type: 'string',
              format: 'uri',
              example: 'https://www.instagram.com/reel/C8AbCdEf123/',
              description: 'Public Instagram URL to process and download'
            },
            quality: {
              type: 'string',
              enum: ['best', 'original', 'audio'],
              default: 'best',
              description: 'Optional quality preset. Pass "audio" for pure MP3 extraction.'
            }
          }
        },
        DownloadResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            requestId: { type: 'string', example: 'req_8f1d3e8a-b420' },
            platform: { type: 'string', example: 'instagram' },
            type: { type: 'string', enum: ['reel', 'post', 'story', 'audio'], example: 'reel' },
            creator: { type: 'string', example: '@username' },
            hasAudio: { type: 'boolean', example: true },
            downloadUrl: { type: 'string', example: 'https://scontent.cdninstagram.com/o1/v/t16/f1.mp4?...' },
            filename: { type: 'string', example: 'instagram_reel_username.mp4' },
            expiresAt: { type: 'string', format: 'date-time', example: '2026-09-18T16:30:00.000Z' },
            quota: { $ref: '#/components/schemas/QuotaStatus' }
          }
        },
        ErrorResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            error: {
              type: 'object',
              properties: {
                code: { type: 'string', example: 'INVALID_URL' },
                message: { type: 'string', example: 'The provided URL is not a valid public Instagram link.' },
                details: { type: 'object' }
              }
            }
          }
        }
      }
    },
    paths: {
      '/api/health': {
        get: {
          summary: 'Health & System Status',
          description: 'Returns API operational health, uptime in seconds, API version, and UTC server timestamp.',
          responses: {
            '200': {
              description: 'API is healthy and operational',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/HealthResponse' }
                }
              }
            }
          }
        }
      },
      '/api/quota': {
        get: {
          summary: 'Monthly Quota Status',
          description: 'Returns current monthly download quota usage, remaining allowance, and calendar month reset timestamp. Quota is persistent across restarts and redeploys.',
          responses: {
            '200': {
              description: 'Quota information retrieved',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/QuotaResponse' }
                }
              }
            }
          }
        }
      },
      '/api/media/analyze': {
        post: {
          summary: 'Analyze Instagram Link (Lightweight & Fast)',
          description: 'Parses and validates a public Instagram URL to extract content type (Reel, Post, Story), creator handle (@username), and audio presence. Does NOT buffer or download heavy video files.',
          security: [{ ApiKeyAuth: [] }, { BearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/AnalyzeRequest' }
              }
            }
          },
          responses: {
            '200': {
              description: 'Media analyzed successfully',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/AnalyzeResponse' }
                }
              }
            },
            '400': {
              description: 'Invalid URL or SSRF attempt blocked',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
            },
            '401': {
              description: 'Authentication required (when API_AUTH_ENABLED=true)',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
            },
            '404': {
              description: 'Media not found on Instagram',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
            },
            '429': {
              description: 'Rate limit or monthly quota exceeded',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
            },
            '500': {
              description: 'Internal server error',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
            },
            '504': {
              description: 'Extraction timed out',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
            }
          }
        }
      },
      '/api/media/download': {
        post: {
          summary: 'Download Public Instagram Media',
          description: 'Generates a direct, authenticated CDN media download link with verified audio streams. Decrements monthly quota by exactly 1 upon successful media generation only.',
          security: [{ ApiKeyAuth: [] }, { BearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/DownloadRequest' }
              }
            }
          },
          responses: {
            '200': {
              description: 'Download link generated successfully',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/DownloadResponse' }
                }
              }
            },
            '400': {
              description: 'Invalid URL or unsupported format',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
            },
            '401': {
              description: 'Authentication required or invalid API key',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
            },
            '403': {
              description: 'Private Instagram account or login required',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
            },
            '429': {
              description: 'Monthly download quota reached (QUOTA_EXCEEDED)',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
            },
            '502': {
              description: 'Upstream media provider error',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
            },
            '504': {
              description: 'Media processing timed out',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
            }
          }
        }
      }
    }
  };

  res.status(200).json(spec);
};

const getDocsUi = (req, res) => {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>PublicMedia API - Interactive OpenAPI Documentation</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
  <style>
    :root {
      --primary: #4f46e5;
      --bg: #09090b;
      --card-bg: #18181b;
      --text: #f4f4f5;
      --border: #27272a;
    }
    body {
      margin: 0;
      padding: 0;
      background: #fafafa;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }
    .top-banner {
      background: #0f172a;
      color: white;
      padding: 16px 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 12px;
      border-bottom: 1px solid #1e293b;
    }
    .top-banner h1 {
      font-size: 18px;
      font-weight: 700;
      margin: 0;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .top-banner .badge {
      background: #4f46e5;
      font-size: 11px;
      padding: 3px 8px;
      border-radius: 9999px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .top-nav {
      display: flex;
      gap: 12px;
      align-items: center;
    }
    .top-nav a {
      color: #94a3b8;
      text-decoration: none;
      font-size: 13px;
      font-weight: 600;
      padding: 6px 12px;
      border-radius: 6px;
      border: 1px solid #334155;
      transition: all 0.15s;
    }
    .top-nav a:hover {
      color: white;
      background: #1e293b;
    }
    .top-nav a.active {
      color: white;
      background: #4f46e5;
      border-color: #4f46e5;
    }
    #swagger-ui {
      max-width: 1200px;
      margin: 0 auto;
      padding: 20px;
    }
    .swagger-ui .topbar { display: none !important; }
    .swagger-ui .info { margin: 20px 0 !important; }
    .swagger-ui .info .title { font-size: 28px !important; color: #0f172a !important; font-weight: 800 !important; }
  </style>
</head>
<body>
  <div class="top-banner">
    <h1>
      <span>⚡ PublicMedia API</span>
      <span class="badge">OpenAPI 3.0</span>
    </h1>
    <div class="top-nav">
      <a href="/portal">Web Portal</a>
      <a href="/api/quota" target="_blank">Quota Status</a>
      <a href="/api/health" target="_blank">Health</a>
      <a href="/api/docs/openapi.json" target="_blank" class="active">OpenAPI JSON</a>
    </div>
  </div>

  <div id="swagger-ui"></div>

  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-standalone-preset.js"></script>
  <script>
    window.onload = function() {
      SwaggerUIBundle({
        url: "/api/docs/openapi.json",
        dom_id: '#swagger-ui',
        deepLinking: true,
        presets: [
          SwaggerUIBundle.presets.apis,
          SwaggerUIStandalonePreset
        ],
        layout: "BaseLayout",
        docExpansion: "list",
        defaultModelsExpandDepth: 2,
        defaultModelExpandDepth: 2
      });
    };
  </script>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
};

module.exports = {
  getOpenApiSpec,
  getDocsUi
};
