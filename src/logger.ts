
import { nanoid } from 'nanoid';
import { LogEntry, Env } from './types';
import { KVNamespace } from '@cloudflare/workers-types';

/**
 * Logger module
 * Provides functions to log events to Cloudflare KV for monitoring and debugging
 */

export class Logger {
  private kv: KVNamespace;
  private requestId: string;
  private context: Record<string, any>;

  constructor(kv: KVNamespace, requestId: string = nanoid(), context: Record<string, any> = {}) {
    this.kv = kv;
    this.requestId = requestId;
    this.context = context;
  }

  /**
   * Log an event with info status
   */
  async info(step: string, details?: any): Promise<void> {
    return this.log(step, 'info', details);
  }

  /**
   * Log an event with success status
   */
  async success(step: string, details?: any): Promise<void> {
    return this.log(step, 'success', details);
  }

  /**
   * Log an event with error status
   */
  async error(step: string, details?: any): Promise<void> {
    return this.log(step, 'error', details);
  }

  /**
   * Log an event to Cloudflare KV
   */
  private async log(step: string, status: 'success' | 'error' | 'info', details?: any): Promise<void> {
    const timestamp = new Date().toISOString();
    
    const entry: LogEntry = {
      requestId: this.requestId,
      timestamp,
      step,
      status,
      details: details ? { ...details, ...this.context } : this.context
    };

    // Generate a unique key for the log entry
    const key = `log:${this.requestId}:${timestamp}`;
    
    try {
      await this.kv.put(key, JSON.stringify(entry), {
        expirationTtl: 60 * 60 * 24 * 7 // Store logs for 7 days
      });
      
      // Also update the list of request IDs for easier retrieval
      const requestListKey = `requests:${this.requestId}`;
      await this.kv.put(requestListKey, timestamp, {
        expirationTtl: 60 * 60 * 24 * 7 // Store for 7 days
      });
      
      // Add to recent requests list
      const recentListKey = 'recent_requests';
      try {
        const recentRequests = await this.kv.get(recentListKey, 'json') as string[] || [];
        // Add to the beginning, keep only last 1000
        const updatedList = [this.requestId, ...recentRequests.filter(id => id !== this.requestId)].slice(0, 1000);
        await this.kv.put(recentListKey, JSON.stringify(updatedList), {
          expirationTtl: 60 * 60 * 24 * 7 // Store for 7 days
        });
      } catch (error) {
        console.error('Error updating recent requests list:', error);
        // Continue even if this fails - this is just a convenience index
      }
    } catch (error) {
      console.error('Failed to write log to KV:', error);
      // Fall back to console logging if KV fails
      console.log(JSON.stringify(entry));
    }
  }

  /**
   * Retrieve logs for a specific request
   */
  static async getRequestLogs(kv: KVNamespace, requestId: string): Promise<LogEntry[]> {
    try {
      const prefix = `log:${requestId}:`;
      const { keys } = await kv.list({ prefix });
      
      if (keys.length === 0) {
        return [];
      }
      
      const logEntries: LogEntry[] = [];
      for (const key of keys) {
        const logJson = await kv.get(key.name);
        if (logJson) {
          try {
            const log = JSON.parse(logJson) as LogEntry;
            logEntries.push(log);
          } catch (e) {
            console.error(`Failed to parse log entry ${key.name}:`, e);
          }
        }
      }
      
      // Sort by timestamp (newest first)
      return logEntries.sort((a, b) => 
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
    } catch (error) {
      console.error('Error retrieving logs:', error);
      throw new Error(`Failed to retrieve logs: ${error.message}`);
    }
  }

  /**
   * Get recent request IDs
   */
  static async getRecentRequestIds(kv: KVNamespace, limit: number = 100): Promise<string[]> {
    try {
      const recentListKey = 'recent_requests';
      const recentRequests = await kv.get(recentListKey, 'json') as string[] || [];
      return recentRequests.slice(0, limit);
    } catch (error) {
      console.error('Error retrieving recent request IDs:', error);
      throw new Error(`Failed to retrieve recent request IDs: ${error.message}`);
    }
  }
}
