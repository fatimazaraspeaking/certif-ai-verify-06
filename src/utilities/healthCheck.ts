
import { Env } from '../types';

/**
 * Health check utility
 * Provides functions to check the health of the worker and its dependencies
 */

export async function performHealthCheck(env: Env): Promise<{
  status: 'ok' | 'degraded' | 'error';
  timestamp: string;
  version: string;
  environment: Record<string, string>;
  checks: Record<string, {
    status: 'ok' | 'error';
    details?: string;
  }>;
}> {
  const checks: Record<string, { status: 'ok' | 'error'; details?: string }> = {};
  let overallStatus: 'ok' | 'degraded' | 'error' = 'ok';
  
  // Check environment variables
  if (!env.MISTRAL_API_KEY) {
    checks.mistral_api = { 
      status: 'error', 
      details: 'MISTRAL_API_KEY is not configured' 
    };
    overallStatus = 'degraded';
  } else {
    checks.mistral_api = { status: 'ok' };
  }
  
  if (!env.JWT_SECRET) {
    checks.jwt_secret = { 
      status: 'error', 
      details: 'JWT_SECRET is not configured' 
    };
    overallStatus = 'degraded';
  } else {
    checks.jwt_secret = { status: 'ok' };
  }
  
  // Check database connection
  try {
    const dbCheck = await env.DB.prepare('SELECT 1').first();
    if (dbCheck) {
      checks.database = { status: 'ok' };
    } else {
      checks.database = { 
        status: 'error', 
        details: 'Database connection check failed' 
      };
      overallStatus = 'error';
    }
  } catch (error) {
    checks.database = { 
      status: 'error', 
      details: `Database error: ${error.message}` 
    };
    overallStatus = 'error';
  }
  
  // Check KV namespaces
  try {
    await env.VERIFICATION_LOGS.put('health_check', 'ok', { expirationTtl: 60 });
    const logsCheck = await env.VERIFICATION_LOGS.get('health_check');
    
    if (logsCheck === 'ok') {
      checks.verification_logs = { status: 'ok' };
    } else {
      checks.verification_logs = { 
        status: 'error', 
        details: 'VERIFICATION_LOGS KV check failed' 
      };
      overallStatus = 'degraded';
    }
  } catch (error) {
    checks.verification_logs = { 
      status: 'error', 
      details: `VERIFICATION_LOGS KV error: ${error.message}` 
    };
    overallStatus = 'degraded';
  }
  
  try {
    await env.CACHE.put('health_check', 'ok', { expirationTtl: 60 });
    const cacheCheck = await env.CACHE.get('health_check');
    
    if (cacheCheck === 'ok') {
      checks.cache = { status: 'ok' };
    } else {
      checks.cache = { 
        status: 'error', 
        details: 'CACHE KV check failed' 
      };
      overallStatus = 'degraded';
    }
  } catch (error) {
    checks.cache = { 
      status: 'error', 
      details: `CACHE KV error: ${error.message}` 
    };
    overallStatus = 'degraded';
  }
  
  // Get environment information
  const environment: Record<string, string> = {
    MISTRAL_API_KEY: env.MISTRAL_API_KEY ? 'configured' : 'missing',
    JWT_SECRET: env.JWT_SECRET ? 'configured' : 'missing',
    DB: checks.database.status === 'ok' ? 'connected' : 'error',
    VERIFICATION_LOGS: checks.verification_logs.status === 'ok' ? 'connected' : 'error',
    CACHE: checks.cache.status === 'ok' ? 'connected' : 'error'
  };
  
  return {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    environment,
    checks
  };
}
