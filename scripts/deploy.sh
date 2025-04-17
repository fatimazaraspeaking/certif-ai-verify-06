
#!/bin/bash
# Deployment script for Certificate Verification Worker

echo "🚀 Deploying Certificate Verification Worker..."

# Check if wrangler is installed
if ! command -v wrangler &> /dev/null
then
    echo "❌ Wrangler CLI is not installed. Installing..."
    npm install -g wrangler
fi

# Set environment variables from .env file or cloud secrets
if [ -f .env ]; then
    echo "📁 Loading environment variables from .env file..."
    source .env
fi

# Validate required environment variables
if [ -z "$CLOUDFLARE_API_TOKEN" ]; then
    echo "❌ CLOUDFLARE_API_TOKEN is not set. Please set it and try again."
    exit 1
fi

if [ -z "$MISTRAL_API_KEY" ]; then
    echo "❓ MISTRAL_API_KEY is not set. Do you want to continue without it? (y/n)"
    read -r answer
    if [ "$answer" != "y" ]; then
        echo "🛑 Deployment cancelled."
        exit 1
    fi
    echo "⚠️ Warning: Deploying without MISTRAL_API_KEY. Verification functionality will not work."
fi

# Run tests before deployment
echo "🧪 Running tests..."
npm test

if [ $? -ne 0 ]; then
    echo "❌ Tests failed. Do you want to continue with deployment? (y/n)"
    read -r answer
    if [ "$answer" != "y" ]; then
        echo "🛑 Deployment cancelled."
        exit 1
    fi
    echo "⚠️ Warning: Deploying with failed tests."
fi

# Build the project
echo "🔨 Building the project..."
npm run build

# Apply database migrations
echo "🗃️ Applying database migrations..."
wrangler d1 migrations apply certificate_verification

# Deploy the worker
echo "🚀 Deploying to Cloudflare Workers..."
wrangler deploy

# Output deployment information
echo "✅ Deployment completed!"
echo "🔗 Your worker is available at: https://certificate-verification-worker.your-domain.workers.dev"
echo "📝 Run the following command to view logs: wrangler tail"
