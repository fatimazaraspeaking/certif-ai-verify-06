
import { Env, VerificationResponse, ErrorResponse, LogEntry, LogsResponse } from './types';
import { nanoid } from 'nanoid';
import { Logger } from './logger';
import { processCertificateVerification } from './verification';
import { ExecutionContext } from '@cloudflare/workers-types';

/**
 * Certificate Verification Worker
 * Cloudflare Worker for verifying educational certificates with Mistral AI OCR
 */

export default {
  /**
   * Main handler for all API requests
   */
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const requestId = nanoid();
    const url = new URL(request.url);
    const path = url.pathname;
    
    // Simple request logging
    console.log(`[${requestId}] ${request.method} ${path}`);
    
    try {
      // Basic CORS headers
      const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      };
      
      // Handle OPTIONS requests for CORS
      if (request.method === 'OPTIONS') {
        return new Response(null, {
          status: 204,
          headers: corsHeaders
        });
      }
      
      // Route requests
      if (path.startsWith('/verify/')) {
        return await handleVerification(request, env, requestId);
      } else if (path === '/logs' || path.startsWith('/logs/')) {
        return await handleLogs(request, env);
      } else if (path === '/health') {
        return handleHealthCheck(env);
      } else {
        // Return 404 for unknown routes
        return jsonResponse(
          {
            success: false,
            error: 'Not Found',
            code: 404,
            requestId,
            timestamp: new Date().toISOString()
          } as ErrorResponse,
          404,
          corsHeaders
        );
      }
    } catch (error) {
      console.error(`[${requestId}] Unhandled error:`, error);
      
      // Log the error
      const logger = new Logger(env.VERIFICATION_LOGS, requestId);
      ctx.waitUntil(logger.error('unhandled_error', {
        error: error.message,
        stack: error.stack,
        path
      }));
      
      // Return error response
      return jsonResponse(
        {
          success: false,
          error: `An unexpected error occurred: ${error.message}`,
          code: 500,
          requestId,
          timestamp: new Date().toISOString()
        } as ErrorResponse,
        500
      );
    }
  }
};

/**
 * Handle verification requests
 * Route: /verify/:userId/:certificateId
 */
async function handleVerification(request: Request, env: Env, requestId: string): Promise<Response> {
  const url = new URL(request.url);
  const pathParts = url.pathname.split('/').filter(part => part);
  
  // Validate path format
  if (pathParts.length !== 3 || pathParts[0] !== 'verify') {
    return jsonResponse({
      success: false,
      error: 'Invalid verification path. Expected format: /verify/:userId/:certificateId',
      code: 400,
      requestId,
      timestamp: new Date().toISOString()
    } as ErrorResponse, 400);
  }
  
  const userId = pathParts[1];
  const certificateId = pathParts[2];
  
  // Validate request parameters
  if (!userId || !certificateId) {
    return jsonResponse({
      success: false,
      error: 'Missing required parameters: userId and certificateId',
      code: 400,
      requestId,
      timestamp: new Date().toISOString()
    } as ErrorResponse, 400);
  }
  
  // Process the verification
  try {
    const result = await processCertificateVerification(env, userId, certificateId, requestId);
    
    // Return appropriate response based on result
    return jsonResponse({
      success: result.success,
      status: result.status,
      message: result.message,
      details: result.details,
      requestId,
      timestamp: new Date().toISOString()
    } as VerificationResponse, result.success ? 200 : 400);
  } catch (error) {
    console.error(`[${requestId}] Verification error:`, error);
    
    return jsonResponse({
      success: false,
      error: `Verification failed: ${error.message}`,
      code: 500,
      requestId,
      timestamp: new Date().toISOString()
    } as ErrorResponse, 500);
  }
}

/**
 * Handle log retrieval requests
 * Routes:
 * - /logs: Get recent logs
 * - /logs/:requestId: Get logs for a specific request
 */
async function handleLogs(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const pathParts = url.pathname.split('/').filter(part => part);
  
  // Get query parameters
  const limit = parseInt(url.searchParams.get('limit') || '100', 10);
  const cursor = url.searchParams.get('cursor');
  
  try {
    // Route: /logs/:requestId
    if (pathParts.length === 2 && pathParts[0] === 'logs') {
      const requestId = pathParts[1];
      const logs = await Logger.getRequestLogs(env.VERIFICATION_LOGS, requestId);
      
      return jsonResponse({
        logs,
        requestId
      });
    }
    // Route: /logs
    else if (pathParts.length === 1 && pathParts[0] === 'logs') {
      // Get recent request IDs
      const recentRequestIds = await Logger.getRecentRequestIds(env.VERIFICATION_LOGS, limit);
      
      // For each request ID, get a summary log entry
      const logSummaries: LogEntry[] = [];
      
      for (const requestId of recentRequestIds) {
        const logs = await Logger.getRequestLogs(env.VERIFICATION_LOGS, requestId);
        if (logs.length > 0) {
          // Use the first log entry as a summary
          logSummaries.push(logs[0]);
        }
      }
      
      return jsonResponse({
        logs: logSummaries,
        pagination: {
          hasMore: recentRequestIds.length === limit,
          // No real pagination yet, but this is where we would add it
          cursor: recentRequestIds.length > 0 ? recentRequestIds[recentRequestIds.length - 1] : null
        }
      } as LogsResponse);
    }
    
    // Invalid logs path
    return jsonResponse({
      success: false,
      error: 'Invalid logs path. Use /logs or /logs/:requestId',
      code: 400,
      timestamp: new Date().toISOString()
    } as ErrorResponse, 400);
  } catch (error) {
    console.error('Error fetching logs:', error);
    
    return jsonResponse({
      success: false,
      error: `Failed to retrieve logs: ${error.message}`,
      code: 500,
      timestamp: new Date().toISOString()
    } as ErrorResponse, 500);
  }
}

/**
 * Handle health check requests
 * Route: /health
 */
function handleHealthCheck(env: Env): Response {
  const healthInfo = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    environment: {
      MISTRAL_API_KEY: env.MISTRAL_API_KEY ? 'configured' : 'missing',
      DB: 'connected',
      VERIFICATION_LOGS: 'connected',
      CACHE: 'connected'
    }
  };
  
  return jsonResponse(healthInfo);
}

/**
 * Helper function to create JSON responses
 */
function jsonResponse(data: any, status: number = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...headers
    }
  });
}
