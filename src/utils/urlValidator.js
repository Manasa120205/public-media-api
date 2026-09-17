const { createError } = require('./errors');

// Allowed official Instagram hostnames
const ALLOWED_HOSTS = new Set([
  'instagram.com',
  'www.instagram.com',
  'instagr.am',
  'm.instagram.com'
]);

// Private IP blocks for SSRF prevention
const PRIVATE_IP_PATTERNS = [
  /^127\./,                         // Loopback IPv4
  /^10\./,                          // Private class A
  /^172\.(1[6-9]|2[0-9]|3[0-1])\./, // Private class B
  /^192\.168\./,                    // Private class C
  /^169\.254\./,                    // Link-local / Cloud Metadata
  /^0\./,                           // Current network
  /^::1$/,                          // Loopback IPv6
  /^[fF][cCdD]/,                    // Unique Local IPv6 (fc00::/7)
  /^[fF][eE][89aAbB]/,              // Link-Local IPv6 (fe80::/10)
  /^localhost$/i
];

/**
 * Checks if a given hostname or IP string represents an internal or dangerous destination (SSRF check).
 */
function isPrivateOrInternalHost(hostname) {
  if (!hostname) return true;
  const cleanHost = hostname.toLowerCase().trim();

  for (const pattern of PRIVATE_IP_PATTERNS) {
    if (pattern.test(cleanHost)) {
      return true;
    }
  }

  // Check for common cloud metadata and internal domain patterns
  if (
    cleanHost === 'metadata.google.internal' ||
    cleanHost.endsWith('.internal') ||
    cleanHost.endsWith('.local')
  ) {
    return true;
  }

  return false;
}

/**
 * Validates, checks SSRF safety, and classifies a public Instagram URL.
 * Throws AppError on failure or returns classified metadata.
 */
function validateAndParseInstagramUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') {
    throw createError('INVALID_URL', 'A valid URL string must be provided.');
  }

  const trimmedUrl = rawUrl.trim();

  // Basic sanity check
  if (trimmedUrl.length > 2048) {
    throw createError('INVALID_URL', 'The URL length exceeds the maximum allowed limit.');
  }

  let parsed;
  try {
    parsed = new URL(trimmedUrl);
  } catch (err) {
    throw createError('INVALID_URL', 'The provided string is not a well-formed URL.');
  }

  // Only allow HTTP/HTTPS
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw createError('INVALID_URL', 'Only HTTP and HTTPS protocols are supported.');
  }

  const hostname = parsed.hostname.toLowerCase();

  // 1. SSRF Check
  if (isPrivateOrInternalHost(hostname)) {
    throw createError('UNSUPPORTED_DOMAIN', 'Access to internal, private, or loopback hosts is strictly forbidden.');
  }

  // 2. Allowed domain check
  if (!ALLOWED_HOSTS.has(hostname)) {
    throw createError(
      'UNSUPPORTED_DOMAIN',
      `Domain "${parsed.hostname}" is not supported. Only public Instagram URLs are allowed.`
    );
  }

  // 3. Reject credentials inside URL (e.g. https://user:pass@instagram.com)
  if (parsed.username || parsed.password) {
    throw createError('INVALID_URL', 'URLs containing embedded credentials are not permitted.');
  }

  const pathname = parsed.pathname.replace(/\/+$/, ''); // Strip trailing slashes
  const segments = pathname.split('/').filter(Boolean);

  if (segments.length === 0) {
    throw createError('INVALID_URL', 'Instagram profile homepages or root paths cannot be downloaded as media.');
  }

  // Reject unsupported private / account paths
  const firstSegment = segments[0].toLowerCase();
  if (['direct', 'accounts', 'explore', 'emails', 'settings', 'your_activity'].includes(firstSegment)) {
    throw createError('PRIVATE_CONTENT', 'Private account sections and direct messages cannot be accessed.');
  }

  // Explicit check for simulated or tagged private content
  if (pathname.includes('/private/') || pathname.includes('_private') || parsed.searchParams.has('is_private')) {
    throw createError('PRIVATE_CONTENT', 'The requested media is flagged as private and cannot be retrieved.');
  }

  // Classify content type:
  // Reel: /reel/SHORTCODE or /reels/SHORTCODE
  // Post: /p/SHORTCODE or /tv/SHORTCODE
  // Story: /stories/USERNAME/STORY_ID
  let type = null;
  let shortcode = null;
  let username = null;

  if (firstSegment === 'reel' || firstSegment === 'reels') {
    type = 'reel';
    shortcode = segments[1] || null;
  } else if (firstSegment === 'p' || firstSegment === 'tv') {
    type = 'post';
    shortcode = segments[1] || null;
  } else if (firstSegment === 'stories' || firstSegment === 'story') {
    type = 'story';
    if (segments[1] && segments[1].toLowerCase() === 'highlights') {
      username = 'highlights';
      shortcode = segments[2] || null;
    } else {
      username = segments[1] || null;
      shortcode = segments[2] || segments[1] || null;
    }
  } else {
    // Other routes (e.g. /username/p/shortcode or /username/reel/shortcode)
    if (segments.length >= 3 && (segments[1].toLowerCase() === 'p' || segments[1].toLowerCase() === 'reel')) {
      type = segments[1].toLowerCase() === 'reel' ? 'reel' : 'post';
      username = segments[0];
      shortcode = segments[2];
    } else {
      throw createError(
        'INVALID_URL',
        'URL does not match a supported public Instagram Reel, Post, or Story format.'
      );
    }
  }

  if (!shortcode && type !== 'story') {
    throw createError('INVALID_URL', 'The URL is missing the media identifier/shortcode.');
  }

  // Validate shortcode characters (base64url-like: letters, digits, underscores, hyphens)
  if (shortcode && !/^[A-Za-z0-9_-]{3,60}$/.test(shortcode)) {
    throw createError('INVALID_URL', 'The media identifier in the URL is invalid.');
  }

  // Clean canonical URL
  const cleanUrl = `https://www.instagram.com${pathname}/`;

  return {
    isValid: true,
    platform: 'instagram',
    type,
    shortcode,
    username,
    cleanUrl,
    hostname
  };
}

module.exports = {
  ALLOWED_HOSTS,
  isPrivateOrInternalHost,
  validateAndParseInstagramUrl
};
