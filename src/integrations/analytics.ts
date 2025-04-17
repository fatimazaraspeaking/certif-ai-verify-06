
import { Env } from '../types';

/**
 * Analytics module for tracking verification metrics
 */

interface VerificationMetrics {
  totalVerifications: number;
  successfulVerifications: number;
  failedVerifications: number;
  averageProcessingTimeMs: number;
}

interface MetricsDataPoint {
  timestamp: number;
  certificateId: string;
  userId: string;
  success: boolean;
  processingTimeMs: number;
}

const METRICS_KEY_PREFIX = 'metrics:';
const METRICS_DAY_KEY = 'metrics:daily:';
const METRICS_HOUR_KEY = 'metrics:hourly:';

/**
 * Record a verification event for analytics
 */
export async function recordVerificationEvent(
  env: Env,
  userId: string,
  certificateId: string,
  success: boolean,
  processingTimeMs: number
): Promise<void> {
  const now = Date.now();
  const timestamp = Math.floor(now / 1000);
  
  // Create metrics data point
  const dataPoint: MetricsDataPoint = {
    timestamp,
    certificateId,
    userId,
    success,
    processingTimeMs
  };
  
  // Generate keys for different time windows
  const dailyKey = `${METRICS_DAY_KEY}${Math.floor(now / (1000 * 60 * 60 * 24))}`;
  const hourlyKey = `${METRICS_HOUR_KEY}${Math.floor(now / (1000 * 60 * 60))}`;
  
  try {
    // Store the individual data point with a short TTL
    const dataPointKey = `${METRICS_KEY_PREFIX}event:${timestamp}:${certificateId}`;
    await env.CACHE.put(dataPointKey, JSON.stringify(dataPoint), {
      expirationTtl: 60 * 60 * 24 * 7 // Keep for 7 days
    });
    
    // Update daily metrics
    await updateAggregateMetrics(env, dailyKey, dataPoint, 60 * 60 * 24);
    
    // Update hourly metrics
    await updateAggregateMetrics(env, hourlyKey, dataPoint, 60 * 60);
  } catch (error) {
    console.error('Error recording verification metrics:', error);
    // Non-blocking - we don't want analytics to affect the main flow
  }
}

/**
 * Update aggregate metrics for a given time window
 */
async function updateAggregateMetrics(
  env: Env,
  key: string,
  dataPoint: MetricsDataPoint,
  expirationTtl: number
): Promise<void> {
  try {
    // Get current metrics
    const currentMetricsJson = await env.CACHE.get(key);
    const metrics: VerificationMetrics = currentMetricsJson 
      ? JSON.parse(currentMetricsJson)
      : {
          totalVerifications: 0,
          successfulVerifications: 0,
          failedVerifications: 0,
          averageProcessingTimeMs: 0
        };
    
    // Update metrics with new data point
    metrics.totalVerifications += 1;
    
    if (dataPoint.success) {
      metrics.successfulVerifications += 1;
    } else {
      metrics.failedVerifications += 1;
    }
    
    // Update average processing time
    const totalProcessingTime = metrics.averageProcessingTimeMs * (metrics.totalVerifications - 1) + 
                               dataPoint.processingTimeMs;
    metrics.averageProcessingTimeMs = totalProcessingTime / metrics.totalVerifications;
    
    // Store updated metrics
    await env.CACHE.put(key, JSON.stringify(metrics), {
      expirationTtl
    });
  } catch (error) {
    console.error(`Error updating aggregate metrics for ${key}:`, error);
  }
}

/**
 * Get verification metrics for a specific time window
 */
export async function getVerificationMetrics(
  env: Env,
  timeWindow: 'hourly' | 'daily' = 'daily',
  count: number = 24
): Promise<{ [key: string]: VerificationMetrics }> {
  const now = Date.now();
  const results: { [key: string]: VerificationMetrics } = {};
  
  try {
    const keyPrefix = timeWindow === 'hourly' ? METRICS_HOUR_KEY : METRICS_DAY_KEY;
    const windowSizeMs = timeWindow === 'hourly' ? 1000 * 60 * 60 : 1000 * 60 * 60 * 24;
    
    // Get metrics for each time window
    for (let i = 0; i < count; i++) {
      const timestamp = now - (i * windowSizeMs);
      const windowId = Math.floor(timestamp / windowSizeMs);
      const key = `${keyPrefix}${windowId}`;
      
      const metricsJson = await env.CACHE.get(key);
      if (metricsJson) {
        const metrics = JSON.parse(metricsJson) as VerificationMetrics;
        
        // Format readable key based on timestamp
        const date = new Date(windowId * windowSizeMs);
        const readableKey = timeWindow === 'hourly'
          ? date.toISOString().substring(0, 13) + ':00'
          : date.toISOString().substring(0, 10);
        
        results[readableKey] = metrics;
      }
    }
    
    return results;
  } catch (error) {
    console.error('Error fetching verification metrics:', error);
    return {};
  }
}
