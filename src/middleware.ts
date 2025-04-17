
import { Env, ErrorResponse } from './types';
import { checkRateLimit, verifyAuthToken } from './integrations/securityEnhancements';
import { nanoid } from 'nanoid';

/**
 * Middleware functions for request processing
 */

// CORS middleware
export function corsHeaders(origin: string = '*'): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, X-Request-ID',
    'Access-Control-Max-Age': '86400',
  };
}

// Rate limiting middleware
export async function handleRateLimit(
  request: Request,
  env: Env,
  endpoint: string,
  limit?: number
): Promise<Response | null> {
  const clientIP = request.headers.get('CF-Connecting-IP') || 
                   request.headers.get('X-Forwarded-For') || 
                   'unknown';
  
  const rateLimitResult = await checkRateLimit(env, clientIP, endpoint, limit);
  
  if (!rateLimitResult.allowed) {
    const headers = {
      ...corsHeaders(),
      'Retry-After': `${rateLimitResult.retryAfter || 60}`,
      'X-RateLimit-Limit': `${limit || 50}`,
      'X-RateLimit-Remaining': '0',
      'X-RateLimit-Reset': `${rateLimitResult.resetAt}`
    };
    
    const errorResponse: ErrorResponse = {
      success: false,
      error: 'Rate limit exceeded',
      code: 429,
      timestamp: new Date().toISOString()
    };
    
    return new Response(JSON.stringify(errorResponse), {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    });
  }
  
  return null;
}

// Authorization middleware
export function checkAuth(
  request: Request,
  env: Env
): { authorized: boolean; userId?: string; error?: string } {
  // Skip auth for certain endpoints
  const url = new URL(request.url);
  if (url.pathname === '/health' || request.method === 'OPTIONS') {
    return { authorized: true };
  }
  
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { 
      authorized: false, 
      error: 'Authorization header missing or invalid'
    };
  }
  
  const token = authHeader.replace('Bearer ', '');
  const authResult = verifyAuthToken(token, env.JWT_SECRET);
  
  return {
    authorized: authResult.valid,
    userId: authResult.userId,
    error: authResult.error
  };
}

// Request ID middleware
export function ensureRequestId(request: Request): string {
  return request.headers.get('X-Request-ID') || nanoid();
}

// Error handler middleware
export function handleError(error: Error, requestId: string): Response {
  console.error(`[${requestId}] Unhandled error:`, error);
  
  const errorResponse: ErrorResponse = {
    success: false,
    error: `An unexpected error occurred: ${error.message}`,
    code: 500,
    requestId,
    timestamp: new Date().toISOString()
  };
  
  return new Response(JSON.stringify(errorResponse), {
    status: 500,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders()
    }
  });
}

// JSON response helper
export function jsonResponse(
  data: any, 
  status: number = 200, 
  additionalHeaders: Record<string, string> = {}
): Response {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders(),
      ...additionalHeaders
    }
  });
}
