
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
    // Simplified query without parameter position markers
    const query = `
      SELECT * FROM certificates
      WHERE id = ? AND user_id = ?
      LIMIT 1
    `;
    
    // Create the prepared statement with the query
    const stmt = db.prepare(query);
    
    // Bind the parameters in order
    const boundStmt = stmt.bind(certificateId, userId);
    
    // Execute the query and get the first result
    const certificate = await boundStmt.first<Certificate>();
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
    // Simplified query
    const query = `
      SELECT * FROM users
      WHERE id = ?
      LIMIT 1
    `;
    
    // More explicit binding to ensure correct parameter association
    const user = await db.prepare(query).bind(userId).first<User>();
    
    // Add debugging logs
    console.log(`User query executed for ID: ${userId}`, user ? 'User found' : 'User not found');
    
    return user || null;
  } catch (error) {
    console.error(`Error fetching user with ID ${userId}:`, error);
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
    
    // Simplified query
    const query = `
      UPDATE certificates
      SET verification_status = ?,
          verification_details = ?,
          updated_at = ?
      WHERE id = ?
    `;
    
    // Execute the update with explicit parameters
    const result = await db.prepare(query)
      .bind(status, verificationDetails, now, certificateId)
      .run();
    
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
    
    // Simplified query
    const query = `
      INSERT INTO verification_logs (id, certificate_id, verification_step, status, details, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
      RETURNING *
    `;
    
    // Execute with explicit parameters
    const log = await db.prepare(query)
      .bind(id, certificateId, step, status, detailsJson, now)
      .first<VerificationLog>();
    
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
    // Simplified query
    const query = `
      SELECT * FROM verification_logs
      WHERE certificate_id = ?
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `;
    
    // Execute with explicit parameters
    const { results } = await db.prepare(query)
      .bind(certificateId, limit, offset)
      .all<VerificationLog>();
    
    return results;
  } catch (error) {
    console.error('Error fetching verification logs:', error);
    throw new Error(`Database error: Failed to fetch verification logs: ${error.message}`);
  }
}
