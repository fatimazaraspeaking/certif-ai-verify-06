
import { verifyCertificate } from './mistral';
import { MistralVerificationResponse } from './types';
import { jest, describe, it, expect, beforeEach } from '@jest/globals';

// Mock fetch function
global.fetch = jest.fn() as jest.MockedFunction<typeof fetch>;

describe('Mistral AI Verification', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('should successfully verify a certificate', async () => {
    // Mock successful response
    const mockResponse: MistralVerificationResponse = {
      document_a: {
        student_name: 'John Doe',
        institution_name: 'University of Example',
        degree_or_program: 'Computer Science',
        date_of_issue: '2023-01-15',
        certificate_title: 'Bachelor Degree',
        signatures: ['Dean', 'President'],
        seals_or_stamps: ['University Seal'],
        document_a_confidence_score: 0.95
      },
      document_b: {
        document_b_confidence_score: 0.9
      },
      verification_url_valid: true,
      total_verification: 'pass'
    };

    // Setup mock fetch response
    (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify(mockResponse)
            }
          }
        ]
      })
    } as Response);

    // Call the function
    const result = await verifyCertificate(
      'fake-api-key',
      'https://example.com/certificate.pdf',
      'https://example.com/verification.pdf'
    );

    // Assertions
    expect(result).toEqual(mockResponse);
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.mistral.ai/v1/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Authorization': 'Bearer fake-api-key'
        })
      })
    );
  });

  it('should handle API errors', async () => {
    // Setup mock fetch error response
    (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
      ok: false,
      json: async () => ({
        error: {
          message: 'Invalid API key'
        }
      })
    } as Response);

    // Call the function and expect it to throw
    await expect(
      verifyCertificate(
        'invalid-api-key',
        'https://example.com/certificate.pdf',
        'https://example.com/verification.pdf'
      )
    ).rejects.toThrow();

    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('should handle parsing errors in the response', async () => {
    // Setup mock fetch with invalid JSON response
    (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: 'This is not valid JSON'
            }
          }
        ]
      })
    } as Response);

    // Call the function and expect it to throw
    await expect(
      verifyCertificate(
        'fake-api-key',
        'https://example.com/certificate.pdf',
        'https://example.com/verification.pdf'
      )
    ).rejects.toThrow();

    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});
