# Deployment Guide

This guide covers deploying the AI Client Dashboard to various platforms.

## Prerequisites

Before deploying, ensure you have:

1. A Supabase project set up with the schema applied
2. AI provider API keys configured
3. Environment variables ready

## Environment Variables

Set these environment variables in your deployment platform:

```bash
# Required
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_key
OPENAI_API_KEY=your_openai_key

# Optional
ANTHROPIC_API_KEY=your_anthropic_key
GOOGLE_GENERATIVE_AI_API_KEY=your_google_key
WORKER_POLL_INTERVAL_MS=5000
WORKER_MAX_CONCURRENT_JOBS=3
```

---

## Vercel Deployment

### 1. Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/your-username/ai-client-dashboard.git
git push -u origin main
```

### 2. Import to Vercel

1. Go to [vercel.com](https://vercel.com)
2. Click "Add New Project"
3. Import your GitHub repository
4. Configure environment variables
5. Click "Deploy"

### 3. Deploy Background Worker

Vercel doesn't support long-running processes. For the worker:

**Option A**: Use a separate service (Railway, Render, Fly.io)
**Option B**: Use Vercel Cron + API routes
**Option C**: Use Supabase Edge Functions

Example Railway deployment for worker:

```bash
# On Railway
railway init
railway up --cmd "npm run worker:prod"
```

---

## Docker Deployment

### Build Images

```bash
# Build web image
docker build -t ai-client-dashboard .

# Build worker image
docker build -f Dockerfile.worker -t ai-client-dashboard-worker .
```

### Run with Docker Compose

```bash
# Copy environment file
cp .env.example .env

# Edit .env with your values
nano .env

# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

### Run with Ollama (Local AI)

```bash
docker-compose --profile ollama up -d
```

---

## AWS Deployment

### Using ECS (Elastic Container Service)

1. **Create ECR Repository**
```bash
aws ecr create-repository --repository-name ai-client-dashboard
aws ecr create-repository --repository-name ai-client-dashboard-worker
```

2. **Build and Push Images**
```bash
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin <account>.dkr.ecr.us-east-1.amazonaws.com

docker build -t <account>.dkr.ecr.us-east-1.amazonaws.com/ai-client-dashboard .
docker push <account>.dkr.ecr.us-east-1.amazonaws.com/ai-client-dashboard

docker build -f Dockerfile.worker -t <account>.dkr.ecr.us-east-1.amazonaws.com/ai-client-dashboard-worker .
docker push <account>.dkr.ecr.us-east-1.amazonaws.com/ai-client-dashboard-worker
```

3. **Create ECS Task Definitions and Services**

Use the AWS Console or Terraform/CloudFormation.

---

## Google Cloud Run

### Deploy Web

```bash
gcloud run deploy ai-client-dashboard \
  --source . \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars NEXT_PUBLIC_SUPABASE_URL=your_url,NEXT_PUBLIC_SUPABASE_ANON_KEY=your_key,SUPABASE_SERVICE_ROLE_KEY=your_key,OPENAI_API_KEY=your_key
```

### Deploy Worker

```bash
gcloud run deploy ai-client-dashboard-worker \
  --source . \
  --platform managed \
  --region us-central1 \
  --command npm \
  --args run,worker:prod \
  --set-env-vars NEXT_PUBLIC_SUPABASE_URL=your_url,SUPABASE_SERVICE_ROLE_KEY=your_key,OPENAI_API_KEY=your_key
```

---

## Railway Deployment

### One-Click Deploy

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/template/new)

### Manual Deploy

```bash
# Install Railway CLI
npm i -g @railway/cli

# Login
railway login

# Initialize project
railway init

# Deploy web
railway up

# Deploy worker (separate service)
railway up --cmd "npm run worker:prod"
```

---

## Render Deployment

### Web Service

1. Create new Web Service
2. Connect your repository
3. Build Command: `npm run build`
4. Start Command: `npm start`
5. Add environment variables

### Background Worker

1. Create new Background Worker
2. Connect your repository
3. Build Command: `npm install`
4. Start Command: `npm run worker:prod`

---

## Kubernetes Deployment

### Create Manifests

```yaml
# deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ai-client-dashboard
spec:
  replicas: 2
  selector:
    matchLabels:
      app: ai-client-dashboard
  template:
    metadata:
      labels:
        app: ai-client-dashboard
    spec:
      containers:
      - name: web
        image: your-registry/ai-client-dashboard:latest
        ports:
        - containerPort: 3000
        env:
        - name: NEXT_PUBLIC_SUPABASE_URL
          valueFrom:
            secretKeyRef:
              name: app-secrets
              key: supabase-url
        # Add more env vars...
---
apiVersion: v1
kind: Service
metadata:
  name: ai-client-dashboard
spec:
  selector:
    app: ai-client-dashboard
  ports:
  - port: 80
    targetPort: 3000
  type: LoadBalancer
```

### Apply

```bash
kubectl apply -f deployment.yaml
```

---

## Post-Deployment Checklist

1. **Verify Environment Variables**
   - All required variables are set
   - No sensitive data in client-side variables

2. **Test Authentication**
   - Sign up flow works
   - Login/logout works
   - Session persists

3. **Test AI Jobs**
   - Trigger a test AI job
   - Verify worker processes jobs
   - Check logs for errors

4. **Database**
   - RLS policies are active
   - Data is properly isolated

5. **Security**
   - HTTPS is enabled
   - Security headers are set
   - CORS is configured correctly

---

## Monitoring

### Logs

```bash
# Vercel
vercel logs

# Docker
docker-compose logs -f

# Kubernetes
kubectl logs -f deployment/ai-client-dashboard
```

### Health Check

The application doesn't have a dedicated health endpoint yet. Add one:

```typescript
// src/app/api/health/route.ts
export async function GET() {
  return Response.json({ status: 'ok', timestamp: new Date().toISOString() });
}
```

---

## Scaling Considerations

### Database

- Enable Supabase connection pooling
- Add database indexes for frequently queried columns
- Consider read replicas for high traffic

### Worker

- Scale workers horizontally based on queue size
- Implement job priorities
- Add dead letter queue for failed jobs

### Frontend

- Enable Next.js ISR for static pages
- Use CDN for static assets
- Implement caching strategies

---

## Troubleshooting

### Worker Not Processing Jobs

1. Check environment variables
2. Verify Supabase connection
3. Check worker logs for errors
4. Ensure jobs are being queued correctly

### Authentication Issues

1. Verify Supabase URL and keys
2. Check RLS policies
3. Ensure cookies are being set correctly

### AI Provider Errors

1. Verify API keys are valid
2. Check rate limits
3. Review provider status pages

---

## Support

For deployment issues:
- Check application logs
- Review Supabase logs
- Verify network connectivity
- Test locally first
