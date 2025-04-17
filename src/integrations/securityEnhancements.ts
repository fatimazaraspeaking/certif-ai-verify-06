
import { Env } from '../types';
import { nanoid } from 'nanoid';
import { createHmac, timingSafeEqual } from 'crypto';

/**
 * Security enhancements for the certificate verification worker
 * Production-ready implementation with proper JWT authentication and rate limiting
 */

// Rate limiting implementation using Cloudflare KV
export async function checkRateLimit(
  env: Env,
  ip: string,
  endpoint: string,
  limit: number = 50, // Default: 50 requests per minute (increased for production)
  windowSizeInSeconds: number = 60
): Promise<{
  allowed: boolean;
  remaining: number;
  resetAt: number;
  retryAfter?: number;
}> {
  const now = Math.floor(Date.now() / 1000);
  const windowKey = Math.floor(now / windowSizeInSeconds);
  const rateLimitKey = `ratelimit:${ip}:${endpoint}:${windowKey}`;
  
  try {
    // Get current count for this IP and endpoint in the current window
    const currentValue = await env.CACHE.get(rateLimitKey);
    const currentCount = currentValue ? parseInt(currentValue, 10) : 0;
    
    if (currentCount >= limit) {
      // Rate limit exceeded
      const resetTime = (windowKey + 1) * windowSizeInSeconds;
      const retryAfter = resetTime - now;
      
      return {
        allowed: false,
        remaining: 0,
        resetAt: resetTime,
        retryAfter
      };
    }
    
    // Increment the counter with proper error handling
    try {
      await env.CACHE.put(
        rateLimitKey, 
        (currentCount + 1).toString(), 
        { expirationTtl: windowSizeInSeconds + 5 } // Add buffer to ensure proper expiration
      );
    } catch (error) {
      console.error('Failed to update rate limit counter:', error);
      // Allow the request to proceed if we can't update the counter
    }
    
    return {
      allowed: true,
      remaining: limit - (currentCount + 1),
      resetAt: (windowKey + 1) * windowSizeInSeconds
    };
  } catch (error) {
    console.error('Rate limiting error:', error);
    // In case of error, allow the request but log the issue
    return {
      allowed: true,
      remaining: 0,
      resetAt: (windowKey + 1) * windowSizeInSeconds
    };
  }
}

// Generate a proper JWT token for authentication
export function generateAuthToken(userId: string, secretKey: string): string {
  if (!secretKey) {
    throw new Error('JWT_SECRET environment variable is not configured');
  }
  
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = now + 60 * 60; // 1 hour expiration
  
  const header = {
    alg: 'HS256',
    typ: 'JWT'
  };
  
  const payload = {
    sub: userId,
    iat: now,
    exp: expiresAt,
    jti: nanoid(16)
  };
  
  const headerBase64 = Buffer.from(JSON.stringify(header)).toString('base64url');
  const payloadBase64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  
  const signatureInput = `${headerBase64}.${payloadBase64}`;
  const signature = createHmac('sha256', secretKey)
    .update(signatureInput)
    .digest('base64url');
  
  return `${signatureInput}.${signature}`;
}

// Verify a JWT token
export function verifyAuthToken(token: string, secretKey: string): {
  valid: boolean;
  userId?: string;
  error?: string;
} {
  if (!secretKey) {
    return {
      valid: false,
      error: 'JWT_SECRET environment variable is not configured'
    };
  }
  
  try {
    const [headerBase64, payloadBase64, signature] = token.split('.');
    
    if (!headerBase64 || !payloadBase64 || !signature) {
      return {
        valid: false,
        error: 'Invalid token format'
      };
    }
    
    // Verify signature
    const signatureInput = `${headerBase64}.${payloadBase64}`;
    const expectedSignature = createHmac('sha256', secretKey)
      .update(signatureInput)
      .digest('base64url');
    
    // Use timing-safe comparison to prevent timing attacks
    const signatureBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expectedSignature);
    
    if (signatureBuffer.length !== expectedBuffer.length || 
        !timingSafeEqual(signatureBuffer, expectedBuffer)) {
      return {
        valid: false,
        error: 'Invalid signature'
      };
    }
    
    // Decode payload
    let payload;
    try {
      payload = JSON.parse(Buffer.from(payloadBase64, 'base64url').toString());
    } catch (e) {
      return {
        valid: false,
        error: 'Invalid payload'
      };
    }
    
    // Check expiration
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      return {
        valid: false,
        error: 'Token expired'
      };
    }
    
    return {
      valid: true,
      userId: payload.sub
    };
  } catch (error) {
    return {
      valid: false,
      error: `Token validation error: ${error.message}`
    };
  }
}
