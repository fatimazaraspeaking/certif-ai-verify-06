
# Certificate Verification Worker

An advanced Cloudflare Worker API for verifying educational certificates using Mistral AI's OCR capabilities and edge computing.

## 🚀 Features

- **AI-Powered Verification**: Leverages Mistral AI's OCR to analyze certificate authenticity
- **Edge Computing**: Runs on Cloudflare's global network for low-latency verification
- **Persistent Storage**: Utilizes Cloudflare D1 (SQLite) for credential and verification data
- **Comprehensive Logging**: Detailed verification process logging with KV storage
- **Performance Optimization**: Smart caching with KV for repeated verification requests
- **Robust Security**: Secure API design with proper error handling and validation
- **Scalable Architecture**: Built to handle high volumes of verification requests

## 📋 API Endpoints

### Verification Endpoint

```
GET /verify/:userId/:certificateId
```

Initiates the verification process for a certificate.

**Parameters:**
- `userId` - ID of the user who owns the certificate
- `certificateId` - ID of the certificate to verify

**Response Example:**
```json
{
  "success": true,
  "status": "verified",
  "message": "Certificate verified successfully",
  "details": {
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
  },
  "requestId": "abc123",
  "timestamp": "2023-10-05T12:34:56.789Z"
}
```

### Logs Endpoints

```
GET /logs
```

Retrieves recent verification logs with pagination support.

```
GET /logs/:requestId
```

Retrieves detailed logs for a specific verification request.

### Health Check

```
GET /health
```

Checks the health status of the worker with environment configuration details.

## 🧠 Verification Process

1. **Request Validation**: Checks if the user and certificate exist in the database
2. **Status Check**: Verifies if the certificate has already been processed
3. **Document Retrieval**: Gets certificate and verification PDFs from storage
4. **AI Analysis**: Sends documents to Mistral AI for OCR analysis
5. **Verification Logic**: Evaluates AI results against verification criteria
6. **Status Update**: Updates the certificate status in the database
7. **Comprehensive Logging**: Logs each step for auditing and debugging

## 🔧 Technical Architecture

### Core Components

- **Cloudflare Worker**: Edge computing platform for the API
- **Cloudflare D1**: SQLite database for storing certificate and user data
- **Cloudflare KV**: Key-value store for logging and caching
- **Mistral AI API**: OCR and document analysis capabilities

### Database Schema

The worker uses Cloudflare D1 SQLite database with the following schema:

#### Users Table
```sql
CREATE TABLE users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE,
    full_name TEXT NOT NULL,
    wallet_address TEXT UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### Certificates Table
```sql
CREATE TABLE certificates (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(id),
    title TEXT NOT NULL,
    institution_name TEXT NOT NULL,
    program_name TEXT NOT NULL,
    issue_date TEXT NOT NULL,
    verification_url TEXT NOT NULL,
    certificate_url TEXT NOT NULL,
    verification_url_pdf TEXT,
    arweave_url TEXT,
    nft_mint_address TEXT,
    verification_status TEXT NOT NULL DEFAULT 'pending' 
        CHECK (verification_status IN ('pending', 'verified', 'rejected')),
    verification_details TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### Verification Logs Table
```sql
CREATE TABLE verification_logs (
    id TEXT PRIMARY KEY,
    certificate_id TEXT REFERENCES certificates(id),
    verification_step TEXT NOT NULL,
    status TEXT NOT NULL,
    details TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## 🚀 Getting Started

### Prerequisites

- Cloudflare account with Workers and D1 enabled
- Mistral AI API key for OCR capabilities
- Node.js and npm

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/certificate-verification-worker.git
   cd certificate-verification-worker
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure environment variables:
   - Create a `.dev.vars` file for local development:
     ```
     MISTRAL_API_KEY=your_mistral_api_key
     ```

4. Configure Cloudflare resources:
   - Create a D1 database:
     ```bash
     wrangler d1 create certificate_verification
     ```
   - Create KV namespaces:
     ```bash
     wrangler kv:namespace create VERIFICATION_LOGS
     wrangler kv:namespace create CACHE
     ```

5. Update `wrangler.toml` with your resource IDs

### Development

Run the worker locally:
```bash
npm run dev
```

### Deployment

Deploy to Cloudflare Workers:
```bash
npm run deploy
```

## 📊 Performance Considerations

- **Caching Strategy**: Results are cached for 24 hours to minimize API calls
- **Edge Deployment**: Leverages Cloudflare's global network for low latency
- **Efficient Database Queries**: Optimized SQL queries with proper indexing
- **Asynchronous Processing**: Non-blocking I/O for handling multiple requests

## 🔒 Security

- **Input Validation**: Thorough validation of all API inputs
- **Error Handling**: Comprehensive error handling without revealing sensitive information
- **Rate Limiting**: Built-in protection against abuse through Cloudflare
- **Access Control**: Proper authorization checks for all endpoints

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.
