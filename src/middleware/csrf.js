const crypto = require('crypto');

/**
 * Generate a cryptographically secure CSRF token and store it in the session.
 * Returns the token string.
 */
function generateCsrfToken(req) {
  if (!req.session) {
    return null;
  }

  if (!req.session._csrf) {
    req.session._csrf = crypto.randomBytes(32).toString('hex');
  }

  return req.session._csrf;
}

/**
 * Express middleware that validates CSRF tokens on state-changing requests.
 * Tokens can be sent in the `X-CSRF-Token` header or the `csrf-token` form field.
 *
 * Exempted routes are specified in the `opts.exempt` array (method + path patterns).
 *
 * Usage:
 *   const csrf = require('./middleware/csrf');
 *   app.post('/api/endpoint', csrf.validate(['POST', '/api/endpoint']), handler);
 *
 * Or to apply globally after session middleware:
 *   app.use(csrf.exempt('GET', 'HEAD', 'OPTIONS'));
 */
function csrfMiddleware(opts = {}) {
  const {
    strict = true,        // If true, all POST/PUT/DELETE/PATCH must have a valid CSRF token
    pathExempts = [],     // Array of path patterns to exempt from checking
    methodExempts = [],   // Array of HTTP methods to exempt
  } = opts;

  return (req, res, next) => {
    // Skip if no session
    if (!req.session || !req.session.userId) {
      return next();
    }

    // Skip exempt methods
    if (methodExempts.includes(req.method.toUpperCase())) {
      return next();
    }

    // Check if path is exempt (exact match or prefix match)
    const isPathExempt = pathExempts.some(exempt => {
      if (typeof exempt === 'string') {
        return req.path === exempt || req.path.startsWith(exempt + '/');
      }
      if (exempt instanceof RegExp) {
        return exempt.test(req.path);
      }
      return false;
    });

    if (isPathExempt) {
      return next();
    }

    // Strict mode: all non-safe methods must have CSRF
    const isSafe = ['GET', 'HEAD', 'OPTIONS'].includes(req.method.toUpperCase());
    if (strict && !isSafe) {
      // Check for CSRF token in header or form body
      const tokenFromHeader = req.headers['x-csrf-token'];
      const tokenFromBody = req.body && typeof req.body === 'object' && req.body['csrf-token'];
      const token = tokenFromHeader || tokenFromBody;
      const sessionToken = req.session._csrf;

      // Reject when either side is missing or buffers differ in length
      // (timingSafeEqual requires equal-length inputs)
      if (!token || !sessionToken || token.length !== sessionToken.length ||
          !crypto.timingSafeEqual(Buffer.from(token, 'hex'), Buffer.from(sessionToken, 'hex'))) {
        return res.status(403).json({
          error: 'Invalid CSRF token. Please refresh the page and try again.'
        });
      }
    }

    next();
  };
}

/**
 * Get the current CSRF token from the session.
 * If none exists, generate one.
 */
function getToken(req) {
  if (req.session && !req.session._csrf) {
    generateCsrfToken(req);
  }
  return req.session?._csrf || null;
}

module.exports = {
  csrfMiddleware,
  generateCsrfToken,
  getToken,
};
