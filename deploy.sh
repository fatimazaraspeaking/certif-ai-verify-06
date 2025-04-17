
#!/bin/bash
# Production deployment script for Certificate Verification Worker

set -e  # Exit immediately if a command exits with a non-zero status

echo "🚀 Deploying Certificate Verification Worker to production..."

# Check for required environment variables
if [ -z "$CLOUDFLARE_API_TOKEN" ]; then
    echo "❌ CLOUDFLARE_API_TOKEN is required for deployment"
    exit 1
fi

if [ -z "$MISTRAL_API_KEY" ]; then
    echo "❌ MISTRAL_API_KEY is required for verification functionality"
    exit 1
fi

if [ -z "$JWT_SECRET" ]; then
    echo "❌ JWT_SECRET is required for secure authentication"
    echo "Generating a random JWT_SECRET..."
    JWT_SECRET=$(openssl rand -hex 32)
    echo "Generated JWT_SECRET: $JWT_SECRET"
    echo "Please save this value in a secure location"
fi

# Set environment for production
ENVIRONMENT=${1:-production}
echo "🌎 Deploying to environment: $ENVIRONMENT"

# Install dependencies
echo "📦 Installing dependencies..."
npm ci

# Run tests
echo "🧪 Running tests..."
npm test

# Build the project
echo "🔨 Building the project..."
npm run build

# Apply database migrations if needed
echo "🗃️ Applying database migrations..."
wrangler d1 migrations apply certificate_verification --env $ENVIRONMENT

# Set secrets
echo "🔐 Setting environment secrets..."
wrangler secret put MISTRAL_API_KEY --env $ENVIRONMENT << EOF
$MISTRAL_API_KEY
EOF

wrangler secret put JWT_SECRET --env $ENVIRONMENT << EOF
$JWT_SECRET
EOF

# Deploy the worker
echo "🚀 Deploying to Cloudflare Workers..."
wrangler deploy --env $ENVIRONMENT

# Verify deployment
echo "✅ Verifying deployment..."
WORKER_DOMAIN=$(wrangler whoami | grep -o 'certificates\..*\.workers\.dev' || echo "certificate-verification-worker.$ENVIRONMENT.workers.dev")

# Test the health endpoint
echo "🩺 Testing health endpoint..."
HEALTH_CHECK=$(curl -s "https://$WORKER_DOMAIN/health" || echo '{"status":"error"}')

if echo "$HEALTH_CHECK" | grep -q '"status":"ok"'; then
    echo "✅ Deployment successful! Worker is healthy."
else
    echo "⚠️ Worker deployed but health check failed. Please check logs."
    echo "Response: $HEALTH_CHECK"
fi

echo "📝 Deployment complete!"
echo "🔗 Worker URL: https://$WORKER_DOMAIN"
echo "📊 Monitor your worker at: https://dash.cloudflare.com"
