
import { nanoid } from 'nanoid';
import { getCertificate, updateCertificateVerification, createVerificationLog, getUser } from './database';
import { verifyCertificate } from './mistral.ts';
import { Logger } from './logger';
import { Certificate, MistralVerificationResponse, VerificationStatus, Env } from './types';

/**
 * Verification service
 * Core business logic for certificate verification process
 */

/**
 * Process a certificate verification request
 */
export async function processCertificateVerification(
  env: Env,
  userId: string,
  certificateId: string,
  requestId: string = nanoid()
): Promise<{
  success: boolean;
  status: VerificationStatus;
  message: string;
  details?: MistralVerificationResponse;
}> {
  // Initialize logger
  const logger = new Logger(env.VERIFICATION_LOGS, requestId, {
    userId,
    certificateId
  });
  
  try {
    await logger.info('verification_started', { userId, certificateId });
    
    // Check if user exists
    const user = await getUser(env.DB, userId);
    if (!user) {
      await logger.error('user_not_found', { userId });
      return {
        success: false,
        status: 'rejected',
        message: 'User not found'
      };
    }
    
    await logger.info('user_found', { user: { id: user.id, email: user.email } });
    
    // Check if certificate exists
    const certificate = await getCertificate(env.DB, userId, certificateId);
    if (!certificate) {
      await logger.error('certificate_not_found', { userId, certificateId });
      return {
        success: false,
        status: 'rejected',
        message: 'Certificate not found'
      };
    }
    
    await logger.info('certificate_found', { 
      certificate: { 
        id: certificate.id, 
        title: certificate.title,
        status: certificate.verification_status
      }
    });
    
    // Check if certificate is already verified
    if (certificate.verification_status === 'verified') {
      await logger.info('already_verified', { certificateId });
      return {
        success: true,
        status: 'verified',
        message: 'Certificate is already verified'
      };
    }
    
    // Check if we have the required URLs
    if (!certificate.certificate_url || !certificate.verification_url_pdf) {
      await logger.error('missing_verification_documents', {
        has_certificate_url: !!certificate.certificate_url,
        has_verification_url_pdf: !!certificate.verification_url_pdf
      });
      
      // Log to database as well
      await createVerificationLog(
        env.DB,
        certificateId,
        'document_check',
        'error',
        'Missing required verification documents'
      );
      
      return {
        success: false,
        status: 'rejected',
        message: 'Missing required verification documents'
      };
    }
    
    // Try to get from cache first
    const cacheKey = `verification:${certificateId}`;
    const cachedResult = await env.CACHE.get(cacheKey, 'json') as MistralVerificationResponse;
    
    if (cachedResult) {
      await logger.info('cache_hit', { certificateId });
      return {
        success: true,
        status: certificate.verification_status,
        message: 'Certificate verification result from cache',
        details: cachedResult
      };
    }
    
    // Proceed with verification process
    await logger.info('verification_process_started', {
      certificate_url: certificate.certificate_url,
      verification_url_pdf: certificate.verification_url_pdf
    });
    
    // Log to database
    await createVerificationLog(
      env.DB,
      certificateId,
      'verification_process',
      'started',
      'Verification process started'
    );
    
    // Call Mistral AI for verification
    const verificationResult = await verifyCertificate(
      env.MISTRAL_API_KEY,
      certificate.certificate_url,
      certificate.verification_url_pdf
    );
    
    await logger.info('ai_verification_completed', { result: verificationResult });
    
    // Determine verification status based on AI result
    const isVerified = verificationResult.total_verification === 'pass' && 
                       verificationResult.verification_url_valid === true;
    
    const newStatus: VerificationStatus = isVerified ? 'verified' : 'rejected';
    
    // Update certificate status in database
    await updateCertificateVerification(
      env.DB,
      certificateId,
      newStatus,
      verificationResult
    );
    
    await logger.success('verification_status_updated', {
      new_status: newStatus,
      verification_details: verificationResult
    });
    
    // Log final result to database
    await createVerificationLog(
      env.DB,
      certificateId,
      'verification_completed',
      newStatus,
      { result: verificationResult }
    );
    
    // Cache the result
    await env.CACHE.put(cacheKey, JSON.stringify(verificationResult), {
      expirationTtl: 60 * 60 * 24 // Cache for 24 hours
    });
    
    return {
      success: true,
      status: newStatus,
      message: isVerified 
        ? 'Certificate verified successfully' 
        : 'Certificate verification failed',
      details: verificationResult
    };
  } catch (error) {
    console.error('Certificate verification error:', error);
    await logger.error('verification_error', { 
      error: error.message,
      stack: error.stack
    });
    
    // Log error to database
    try {
      await createVerificationLog(
        env.DB,
        certificateId,
        'verification_error',
        'error',
        { error: error.message, stack: error.stack }
      );
    } catch (dbError) {
      console.error('Failed to log error to database:', dbError);
    }
    
    return {
      success: false,
      status: 'rejected',
      message: `Verification process failed: ${error.message}`
    };
  }
}

/**
 * Analyze verification result and determine confidence level
 */
export function analyzeVerificationConfidence(result: MistralVerificationResponse): {
  overallConfidence: number;
  isPassing: boolean;
  reasons: string[];
} {
  const documentAScore = result.document_a.document_a_confidence_score || 0;
  const documentBScore = result.document_b.document_b_confidence_score || 0;
  const isUrlValid = result.verification_url_valid;
  
  // Calculate weighted overall confidence
  const overallConfidence = (documentAScore * 0.5) + (documentBScore * 0.3) + (isUrlValid ? 0.2 : 0);
  
  // Determine if it passes our threshold
  const isPassing = overallConfidence >= 0.7 && isUrlValid && documentAScore >= 0.65;
  
  // Generate reasons
  const reasons: string[] = [];
  
  if (documentAScore < 0.65) {
    reasons.push('Certificate document has low confidence score');
  }
  
  if (documentBScore < 0.6) {
    reasons.push('Verification document has low confidence score');
  }
  
  if (!isUrlValid) {
    reasons.push('Verification URL appears invalid');
  }
  
  if (reasons.length === 0 && isPassing) {
    reasons.push('All verification checks passed successfully');
  }
  
  return {
    overallConfidence,
    isPassing,
    reasons
  };
}
