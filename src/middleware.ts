
import { Env } from './types';
import { checkRateLimit, verifyAuthToken } from './integrations/securityEnhancements';

/**
 * Middleware functions for the worker
 */

/**
 * Rate limiting middleware
 */
export async function rateLimitMiddleware(
  request: Request,
  env: Env,
  endpoint: string,
  limit: number = 10,
  windowSizeInSeconds: number = 60
): Promise<Response | null> {
  // Get client IP (in Cloudflare, this would use request.headers.get('CF-Connecting-IP'))
  const ip = request.headers.get('CF-Connecting-IP') || 
             request.headers.get('X-Forwarded-For') || 
             '127.0.0.1';
  
  // Check rate limit
  const rateLimitResult = await checkRateLimit(env, ip, endpoint, limit, windowSizeInSeconds);
  
  if (!rateLimitResult.allowed) {
    return new Response(JSON.stringify({
      success: false,
      error: 'Rate limit exceeded',
      code: 429,
      resetAt: rateLimitResult.resetAt,
      timestamp: new Date().toISOString()
    }), {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'X-RateLimit-Limit': limit.toString(),
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': rateLimitResult.resetAt.toString(),
        'Retry-After': (rateLimitResult.resetAt - Math.floor(Date.now() / 1000)).toString()
      }
    });
  }
  
  // If rate limit is not exceeded, add rate limit headers and continue
  return null;
}

/**
 * Authentication middleware
 */
export function authenticationMiddleware(
  request: Request,
  env: Env,
  requireAuth: boolean = true
): { userId: string | null; isAuthenticated: boolean; errorResponse: Response | null } {
  // Get authentication token from headers
  const authHeader = request.headers.get('Authorization');
  
  if (!authHeader && requireAuth) {
    // If authentication is required but no token is provided
    return {
      userId: null,
      isAuthenticated: false,
      errorResponse: new Response(JSON.stringify({
        success: false,
        error: 'Authentication required',
        code: 401,
        timestamp: new Date().toISOString()
      }), {
        status: 401,
        headers: {
          'Content-Type': 'application/json',
          'WWW-Authenticate': 'Bearer'
        }
      })
    };
  }
  
  if (!authHeader) {
    // If no authentication but it's not required
    return {
      userId: null,
      isAuthenticated: false,
      errorResponse: null
    };
  }
  
  // Parse Bearer token
  const tokenMatch = authHeader.match(/Bearer\s+(.+)/i);
  if (!tokenMatch) {
    return {
      userId: null,
      isAuthenticated: false,
      errorResponse: new Response(JSON.stringify({
        success: false,
        error: 'Invalid authentication format',
        code: 401,
        timestamp: new Date().toISOString()
      }), {
        status: 401,
        headers: {
          'Content-Type': 'application/json',
          'WWW-Authenticate': 'Bearer error="invalid_request"'
        }
      })
    };
  }
  
  const token = tokenMatch[1];
  
  // In a real implementation, we would get the key from environment
  // For demo, we use a placeholder
  const secretKey = env.JWT_SECRET || 'demo-secret-key';
  
  // Verify token
  const verificationResult = verifyAuthToken(token, secretKey);
  
  if (!verificationResult.valid) {
    return {
      userId: null,
      isAuthenticated: false,
      errorResponse: new Response(JSON.stringify({
        success: false,
        error: `Authentication failed: ${verificationResult.error}`,
        code: 401,
        timestamp: new Date().toISOString()
      }), {
        status: 401,
        headers: {
          'Content-Type': 'application/json',
          'WWW-Authenticate': `Bearer error="invalid_token", error_description="${verificationResult.error}"`
        }
      })
    };
  }
  
  // Successfully authenticated
  return {
    userId: verificationResult.userId || null,
    isAuthenticated: true,
    errorResponse: null
  };
}

/**
 * Error handling middleware
 */
export function errorHandlingMiddleware(error: Error, requestId: string): Response {
  console.error(`[${requestId}] Error:`, error);
  
  // Determine if this is a known error type that we want to expose
  const isKnownError = error.name === 'ValidationError' || 
                       error.name === 'DatabaseError' ||
                       error.message.includes('not found') ||
                       error.message.includes('validation');
  
  const errorMessage = isKnownError 
    ? error.message 
    : 'An unexpected error occurred';
  
  return new Response(JSON.stringify({
    success: false,
    error: errorMessage,
    code: isKnownError ? 400 : 500,
    requestId,
    timestamp: new Date().toISOString()
  }), {
    status: isKnownError ? 400 : 500,
    headers: {
      'Content-Type': 'application/json'
    }
  });
}
