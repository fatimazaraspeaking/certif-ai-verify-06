
# Certificate Verification Worker

An advanced Cloudflare Worker API for verifying educational certificates using Mistral AI's OCR capabilities and edge computing.

## 🚀 Features

- **AI-Powered Verification**: Leverages Mistral AI's OCR to analyze certificate authenticity
- **Edge Computing**: Runs on Cloudflare's global network for low-latency verification
- **Persistent Storage**: Utilizes Cloudflare D1 (SQLite) for credential and verification data
- **Comprehensive Logging**: Detailed verification process logging with KV storage
- **Performance Optimization**: Smart caching with KV for repeated verification requests
- **Robust Security**: Secure API design with proper error handling, rate limiting, and JWT authentication
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

**Headers:**
- `Authorization: Bearer <jwt_token>` - JWT token for authentication

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

## 🚀 Deployment Guide

### Prerequisites

- Cloudflare account with Workers and D1 enabled
- Mistral AI API key for OCR capabilities
- Node.js 18+ and npm

### Environment Setup

1. **Create Cloudflare Resources**

   Create the required Cloudflare resources:

   ```bash
   # Create D1 database
   wrangler d1 create certificate_verification

   # Create KV namespaces for logs and cache
   wrangler kv:namespace create VERIFICATION_LOGS
   wrangler kv:namespace create CACHE
   ```

2. **Update wrangler.toml**

   Update your `wrangler.toml` with the IDs of the created resources:

   ```toml
   # KV for storing logs
   [[kv_namespaces]]
   binding = "VERIFICATION_LOGS"
   id = "your-kv-namespace-id-for-logs"
   preview_id = "your-preview-kv-namespace-id-for-logs"

   # KV for caching
   [[kv_namespaces]]
   binding = "CACHE"
   id = "your-kv-namespace-id-for-cache"
   preview_id = "your-preview-kv-namespace-id-for-cache"

   # D1 Database
   [[d1_databases]]
   binding = "DB"
   database_name = "certificate_verification"
   database_id = "your-d1-database-id"
   ```

3. **Set Required Secrets**

   ```bash
   # Set Mistral API key
   wrangler secret put MISTRAL_API_KEY
   
   # Set JWT Secret (for authentication)
   wrangler secret put JWT_SECRET
   ```

### Manual Deployment

```bash
# Run database migrations
wrangler d1 migrations apply certificate_verification

# Deploy the worker
wrangler deploy
```

### Automated Deployment with CI/CD

This project includes a GitHub Actions workflow for automated deployments. To use it:

1. Add the following secrets to your GitHub repository:
   - `CLOUDFLARE_API_TOKEN`
   - `MISTRAL_API_KEY`
   - `JWT_SECRET`

2. Push changes to the `main` branch or use the manual workflow dispatch to trigger deployment.

## 🧠 Verification Process

1. **Request Validation**: Checks if the user and certificate exist in the database
2. **Status Check**: Verifies if the certificate has already been processed
3. **Document Retrieval**: Gets certificate and verification PDFs from storage
4. **AI Analysis**: Sends documents to Mistral AI for OCR analysis
5. **Verification Logic**: Evaluates AI results against verification criteria
6. **Status Update**: Updates the certificate status in the database
7. **Comprehensive Logging**: Logs each step for auditing and debugging

## 🔒 Security Considerations

- **JWT Authentication**: All API endpoints are secured with JWT tokens
- **Rate Limiting**: Prevents abuse through built-in rate limiting
- **Error Handling**: Comprehensive error handling without revealing sensitive information
- **Input Validation**: Thorough validation of all API inputs
- **CORS**: Properly configured CORS headers for web clients

## 📊 Performance Optimization

- **Caching Strategy**: Results are cached for 24 hours to minimize API calls
- **Edge Deployment**: Leverages Cloudflare's global network for low latency
- **Efficient Database Queries**: Optimized SQL queries with proper indexing
- **Asynchronous Processing**: Non-blocking I/O for handling multiple requests

## 📈 Monitoring and Logging

- **Health Endpoint**: `/health` endpoint for monitoring service health
- **Detailed Logs**: Comprehensive logging for debugging and auditing
- **Request Tracing**: Request IDs for correlating logs across systems

## 🛠️ Local Development

```bash
# Install dependencies
npm install

# Run tests
npm test

# Start local development server
wrangler dev

# Apply database migrations (local)
wrangler d1 migrations apply certificate_verification --local
```

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.
