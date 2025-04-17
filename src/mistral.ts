
import { MistralVerificationResponse } from './types';

/**
 * Mistral AI API client
 * Handles communication with Mistral AI for certificate verification
 */

const MISTRAL_API_URL = 'https://api.mistral.ai/v1/chat/completions';
const MISTRAL_MODEL = 'mistral-small-latest';

/**
 * Verify a certificate using Mistral AI OCR capabilities
 */
export async function verifyCertificate(
  apiKey: string,
  certificateUrl: string,
  verificationUrlPdf: string
): Promise<MistralVerificationResponse> {
  try {
    const response = await fetch(MISTRAL_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: MISTRAL_MODEL,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `You are a highly specialized expert in educational credential verification. You have been provided with two image inputs:

1. Document A – An image of an academic certificate.
2. Document B – A screenshot of a webpage, purportedly showing verification of Document A.

Additionally, you are given a third input:
3. (verification_url) – The URL of the webpage that claims to verify the certificate.

Your task is to analyze the above materials and extract relevant data and assess the authenticity of the documents. Follow these instructions:

### 🔍 Certificate Analysis (Document A)

Extract the following information using OCR and visual interpretation:

- student_name – Full name of the certificate holder.
- institution_name – The name of the issuing academic institution.
- degree_or_program – The name of the degree or course completed.
- date_of_issue – The issuance date as printed on the certificate.
- certificate_id – Any unique serial number or verification code.
- certificate_title – The main title or heading of the certificate.
- signatures – List of visible signatures or signatory roles (e.g., "Registrar", "Dean").
- seals_or_stamps – Visual description of any official seals, holograms, or embossed elements.

Provide a document_a_confidence_score (value between 0 and 1) indicating how likely the certificate appears authentic, based on:

- Presence and clarity of official seals/logos
- Professional formatting and consistent layout
- Institutional branding (e.g., logos, watermarks, color themes)
- Valid-looking signatures and their positioning
- Absence of image tampering, blurriness, or formatting anomalies

### 🧠 Verification Page Assessment (Document B)

Evaluate the visual and textual content of the verification screenshot:

- Does it appear to be an official academic verification portal?
- Is the design/layout consistent with the institution from Document A?
- Does it contain verifiable content such as:
  - Matching student_name, certificate_id, and degree_or_program
  - Mentions of the institution's name or logo
  - Phrases such as "Verified," "Issued by," "Valid Certificate," etc.
- Does the document seem visually aligned with Document A (branding, tone, structure)?

Output a document_b_confidence_score between 0 and 1 based on the credibility and match with Document A.

### 🌐 URL Authenticity Check

Examine the ${getVerificationUrlFromPdfUrl(verificationUrlPdf)} :

- Does the degree_or_program name real or just random ?

Return:
- "verification_url_valid": true | false

### 📦 Final Output Format (JSON)

Return only the following JSON structure with all fields completed. If any field is missing or unreadable, set its value to null.

\`\`\`json
{
  "document_a": {
    "student_name": "John Doe",
    "institution_name": "University of Example",
    "degree_or_program": "Bachelor of Science in Computer Science",
    "date_of_issue": "2023-06-15",
    "certificate_title": "Developer Certification",
    "signatures": ["Registrar", "Vice Chancellor"],
    "seals_or_stamps": ["Official University Seal", "Gold embossed emblem"],
    "document_a_confidence_score": 0.92
  },
  "document_b": {
    "document_b_confidence_score": 0.87
  },
  "verification_url_valid": true,
  "total_verification": "pass"
}
\`\`\``
              },
              {
                type: 'document_url',
                document_url: certificateUrl
              },
              {
                type: 'document_url',
                document_url: verificationUrlPdf
              }
            ]
          }
        ],
        document_image_limit: 8,
        document_page_limit: 64
      })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Mistral AI API error: ${error.message || JSON.stringify(error)}`);
    }
    
    const result = await response.json();
    
    // Extract the JSON response from the message content
    let verificationResult: MistralVerificationResponse;
    
    try {
      if (result.choices && result.choices[0] && result.choices[0].message) {
        const content = result.choices[0].message.content;
        
        // Extract JSON from content (handle both JSON string and already parsed object)
        if (typeof content === 'string') {
          // Try to find JSON in the string (it might be wrapped in markdown code blocks)
          const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/) || 
                           content.match(/```\s*([\s\S]*?)\s*```/) ||
                           content.match(/{[\s\S]*}/);
                           
          if (jsonMatch && jsonMatch[1]) {
            verificationResult = JSON.parse(jsonMatch[1]);
          } else {
            // Try parsing the whole content as JSON
            verificationResult = JSON.parse(content);
          }
        } else if (typeof content === 'object') {
          verificationResult = content;
        } else {
          throw new Error('Unexpected response format from Mistral AI');
        }
      } else {
        throw new Error('Invalid response format from Mistral AI');
      }
    } catch (error) {
      console.error('Error parsing Mistral AI response:', error, 'Response:', result);
      throw new Error(`Failed to parse Mistral AI response: ${error.message}`);
    }
    
    return verificationResult;
  } catch (error) {
    console.error('Mistral AI verification error:', error);
    throw new Error(`Certificate verification failed: ${error.message}`);
  }
}

/**
 * Extract verification URL from the PDF URL
 * This is a simple helper function to remove PDF-specific parts
 */
function getVerificationUrlFromPdfUrl(verificationUrlPdf: string): string {
  try {
    // This is a simplified version - in production you might need more sophisticated extraction
    const url = new URL(verificationUrlPdf);
    return `${url.protocol}//${url.hostname}${url.pathname.replace(/\.pdf$/i, '')}`;
  } catch (error) {
    console.error('Error extracting verification URL:', error);
    return verificationUrlPdf; // Return as is if parsing fails
  }
}
