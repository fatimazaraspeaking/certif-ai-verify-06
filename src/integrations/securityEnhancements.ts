
import { Env } from '../types';
import { nanoid } from 'nanoid';

/**
 * Security enhancements for the certificate verification worker
 */

// Rate limiting implementation using Cloudflare KV
export async function checkRateLimit(
  env: Env,
  ip: string,
  endpoint: string,
  limit: number = 10, // Default: 10 requests per minute
  windowSizeInSeconds: number = 60
): Promise<{
  allowed: boolean;
  remaining: number;
  resetAt: number;
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
      return {
        allowed: false,
        remaining: 0,
        resetAt: (windowKey + 1) * windowSizeInSeconds
      };
    }
    
    // Increment the counter
    await env.CACHE.put(
      rateLimitKey, 
      (currentCount + 1).toString(), 
      { expirationTtl: windowSizeInSeconds }
    );
    
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

// Generate a signed JWT token for authentication
export function generateAuthToken(userId: string, secretKey: string): string {
  // This is a simplified implementation
  // In production, use a proper JWT library
  
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = now + 60 * 60; // 1 hour expiration
  
  const payload = {
    sub: userId,
    iat: now,
    exp: expiresAt,
    jti: nanoid(16)
  };
  
  // In a real implementation, this would use proper JWT signing
  // For demo purposes, we'll create a simplified token
  const token = Buffer.from(JSON.stringify(payload)).toString('base64');
  return `${token}.${generateSimpleHmac(token, secretKey)}`;
}

// Verify a JWT token
export function verifyAuthToken(token: string, secretKey: string): {
  valid: boolean;
  userId?: string;
  error?: string;
} {
  try {
    const [payloadBase64, signature] = token.split('.');
    
    // Verify signature (simplified)
    const expectedSignature = generateSimpleHmac(payloadBase64, secretKey);
    if (signature !== expectedSignature) {
      return {
        valid: false,
        error: 'Invalid signature'
      };
    }
    
    // Decode payload
    const payload = JSON.parse(Buffer.from(payloadBase64, 'base64').toString());
    
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

// Simple HMAC implementation (for demo only)
// In production, use a proper crypto library
function generateSimpleHmac(data: string, key: string): string {
  // This is NOT a secure implementation and is for demo purposes only
  let hash = 0;
  const combined = data + key;
  
  for (let i = 0; i < combined.length; i++) {
    const char = combined.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  
  return Math.abs(hash).toString(16);
}
