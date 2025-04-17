
/**
 * Type definitions for the Certificate Verification Worker
 */

// Import Cloudflare Workers types
import { KVNamespace, D1Database, ExecutionContext } from '@cloudflare/workers-types';

// Database Models
export interface User {
  id: string;
  email: string;
  full_name: string;
  wallet_address: string;
  created_at: string;
  updated_at: string;
}

export interface Certificate {
  id: string;
  user_id: string;
  title: string;
  institution_name: string;
  program_name: string;
  issue_date: string;
  verification_url: string;
  certificate_url: string;
  verification_url_pdf?: string;
  arweave_url?: string;
  nft_mint_address?: string;
  verification_status: VerificationStatus;
  verification_details?: string;
  created_at: string;
  updated_at: string;
}

export interface VerificationLog {
  id: string;
  certificate_id: string;
  verification_step: string;
  status: string;
  details?: string;
  created_at: string;
}

// Enum for verification status
export type VerificationStatus = 'pending' | 'verified' | 'rejected';

// Mistral AI Response Types
export interface DocumentA {
  student_name: string | null;
  institution_name: string | null;
  degree_or_program: string | null;
  date_of_issue: string | null;
  certificate_title: string | null;
  signatures: string[] | null;
  seals_or_stamps: string[] | null;
  document_a_confidence_score: number;
}

export interface DocumentB {
  document_b_confidence_score: number;
}

export interface MistralVerificationResponse {
  document_a: DocumentA;
  document_b: DocumentB;
  verification_url_valid: boolean;
  total_verification: 'pass' | 'fail';
  verification_details?: string;
}

// Environment bindings for Cloudflare Worker
export interface Env {
  DB: D1Database;
  VERIFICATION_LOGS: KVNamespace;
  CACHE: KVNamespace;
  MISTRAL_API_KEY: string;
  JWT_SECRET?: string;
}

// API response formats
export interface VerificationResponse {
  success: boolean;
  status: VerificationStatus;
  message: string;
  details?: MistralVerificationResponse;
  timestamp: string;
}

export interface ErrorResponse {
  success: false;
  error: string;
  code: number;
  requestId?: string;
  timestamp: string;
}

export interface LogEntry {
  requestId: string;
  timestamp: string;
  step: string;
  status: 'success' | 'error' | 'info';
  details?: any;
}

export interface LogsResponse {
  logs: LogEntry[];
  pagination?: {
    cursor: string;
    hasMore: boolean;
  };
}
