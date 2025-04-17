
import { nanoid } from 'nanoid';
import { Certificate, VerificationLog, VerificationStatus, User, MistralVerificationResponse } from './types';
import { D1Database } from '@cloudflare/workers-types';

/**
 * Database interaction module
 * Provides functions to interact with Cloudflare D1 database
 */

/**
 * Get a certificate by its ID and user ID
 */
export async function getCertificate(db: D1Database, userId: string, certificateId: string): Promise<Certificate | null> {
  try {
    const stmt = db.prepare(`
      SELECT * FROM certificates
      WHERE id = ? AND user_id = ?
      LIMIT 1
    `);
    
    stmt.bind(certificateId, userId);
    const certificate = await stmt.first<Certificate>();
    return certificate || null;
  } catch (error) {
    console.error('Error fetching certificate:', error);
    throw new Error(`Database error: Failed to fetch certificate: ${error.message}`);
  }
}

/**
 * Get a user by ID
 */
export async function getUser(db: D1Database, userId: string): Promise<User | null> {
  try {
    const stmt = db.prepare(`
      SELECT * FROM users
      WHERE id = ?
      LIMIT 1
    `);
    
    stmt.bind(userId);
    const user = await stmt.first<User>();
    return user || null;
  } catch (error) {
    console.error('Error fetching user:', error);
    throw new Error(`Database error: Failed to fetch user: ${error.message}`);
  }
}

/**
 * Update certificate verification status and details
 */
export async function updateCertificateVerification(
  db: D1Database, 
  certificateId: string, 
  status: VerificationStatus, 
  details?: MistralVerificationResponse
): Promise<void> {
  try {
    const now = new Date().toISOString();
    const verificationDetails = details ? JSON.stringify(details) : null;
    
    const stmt = db.prepare(`
      UPDATE certificates
      SET verification_status = ?,
          verification_details = ?,
          updated_at = ?
      WHERE id = ?
    `);
    
    stmt.bind(status, verificationDetails, now, certificateId);
    const result = await stmt.run();
    
    if (!result.success) {
      throw new Error(`Failed to update certificate: ${result.error || 'Unknown error'}`);
    }
  } catch (error) {
    console.error('Error updating certificate verification:', error);
    throw new Error(`Database error: Failed to update certificate verification: ${error.message}`);
  }
}

/**
 * Create a verification log entry
 */
export async function createVerificationLog(
  db: D1Database,
  certificateId: string,
  step: string,
  status: string,
  details?: any
): Promise<VerificationLog> {
  try {
    const id = nanoid();
    const now = new Date().toISOString();
    const detailsJson = details ? JSON.stringify(details) : null;
    
    const stmt = db.prepare(`
      INSERT INTO verification_logs (id, certificate_id, verification_step, status, details, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
      RETURNING *
    `);
    
    stmt.bind(id, certificateId, step, status, detailsJson, now);
    const log = await stmt.first<VerificationLog>();
    
    if (!log) {
      throw new Error('Failed to create verification log');
    }
    
    return log;
  } catch (error) {
    console.error('Error creating verification log:', error);
    throw new Error(`Database error: Failed to create verification log: ${error.message}`);
  }
}

/**
 * Get verification logs for a certificate
 */
export async function getVerificationLogs(
  db: D1Database,
  certificateId: string,
  limit: number = 50,
  offset: number = 0
): Promise<VerificationLog[]> {
  try {
    const stmt = db.prepare(`
      SELECT * FROM verification_logs
      WHERE certificate_id = ?
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `);
    
    stmt.bind(certificateId, limit, offset);
    const { results } = await stmt.all<VerificationLog>();
    return results;
  } catch (error) {
    console.error('Error fetching verification logs:', error);
    throw new Error(`Database error: Failed to fetch verification logs: ${error.message}`);
  }
}
