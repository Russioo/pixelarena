# Deployment Guide - Docker + Vercel

This project runs with a shared game engine in Docker that streams to all users via Vercel frontend.

## Architecture

1. **Docker Container** - Runs the game engine server (Express on port 8080)
2. **Vercel** - Runs Next.js frontend that proxies to Docker server
3. **SSE Stream** - All users receive the same game state via Server-Sent Events

## Step 1: Deploy Docker Container

You need to deploy the Docker container to a cloud service. Here are some recommendations:

### Option A: Render.com (Recommended - Free tier)

1. Go to [render.com](https://render.com) and log in
2. Click "New +" → "Web Service"
3. Connect your GitHub repository
4. Configuration:
   - **Name**: `pixel-arena-engine`
   - **Environment**: `Docker`
   - **Instance Type**: `Free` (or `Starter` for better performance)
   - **Health Check Path**: `/api/round/state`
5. Click "Create Web Service"
6. Copy the URL (e.g. `https://pixel-arena-engine.onrender.com`)

### Option B: Railway.app

1. Go to [railway.app](https://railway.app) and log in
2. Click "New Project" → "Deploy from GitHub repo"
3. Select your repository
4. Railway automatically detects Dockerfile
5. Add environment variables if needed:
   - `PORT=8080`
   - `FIGHTS_PER_TICK=1200`
   - `TICK_INTERVAL_MS=15`
6. Deploy and copy the generated URL

### Option C: Fly.io

1. Install Fly CLI: `curl -L https://fly.io/install.sh | sh`
2. Log in: `fly auth login`
3. Launch app: `fly launch`
4. Deploy: `fly deploy`

### Option D: Your own server (VPS)

```bash
# On your server
git clone <your-repo>
cd pixel-arena

# Build and run Docker container
docker-compose up -d

# Container now runs on port 8080
# Make sure to open the port in your firewall
```

## Step 2: Configure Vercel

1. Go to your Vercel project dashboard
2. Go to "Settings" → "Environment Variables"
3. Add the following variable:
   - **Key**: `ENGINE_URL`
   - **Value**: URL from Step 1 (e.g. `https://pixel-arena-engine.onrender.com`)
   - **Environments**: Select "Production", "Preview", and "Development"
4. Click "Save"

## Step 3: Redeploy Vercel

```bash
# Trigger redeploy via terminal
vercel --prod

# Or via Vercel dashboard
# Go to "Deployments" tab and click "Redeploy"
```

## Test Setup

1. Open your Vercel URL in browser
2. Open in multiple tabs or different browsers
3. All users should now see the same game state
4. Pixel battles are synchronized across all clients

## Local Testing (With Docker)

```bash
# Start Docker engine locally
docker-compose up

# In another terminal, start Next.js with ENGINE_URL
ENGINE_URL=http://localhost:8080 npm run dev

# Open http://localhost:3000
```

## Monitoring

### Docker Container

- **Render**: Dashboard shows logs and metrics
- **Railway**: See logs in project dashboard
- **Docker Compose**: `docker-compose logs -f game-engine`

### Health Check Endpoint

```bash
curl https://your-engine-url.com/api/round/state
```

## Troubleshooting

### "Failed to connect to game engine"

1. Check that Docker container is running
2. Verify ENGINE_URL is correctly set in Vercel
3. Test engine URL directly: `curl https://your-engine-url.com/api/round/state`

### Stream not updating

1. Check that `/api/stream` endpoint works: `curl https://your-engine-url.com/api/stream`
2. Verify CORS is enabled in Docker server (already configured)
3. Check browser console for errors

### Docker container crashes

1. Check logs: `docker logs <container-id>`
2. Reduce `FIGHTS_PER_TICK` if CPU is too high
3. Increase `TICK_INTERVAL_MS` to reduce CPU load

## Performance Tuning

### Environment Variables

```bash
# In your Docker deployment, adjust these:
FIGHTS_PER_TICK=1200  # Number of pixel battles per tick (lower = faster server)
TICK_INTERVAL_MS=15   # Milliseconds between ticks (higher = less CPU)
```

### Recommended Configuration

- **Free tier**: `FIGHTS_PER_TICK=800`, `TICK_INTERVAL_MS=20`
- **Paid tier**: `FIGHTS_PER_TICK=1200`, `TICK_INTERVAL_MS=15`
- **High performance**: `FIGHTS_PER_TICK=2000`, `TICK_INTERVAL_MS=10`

## Security

The Docker server accepts all connections (CORS enabled). For production:

1. Consider adding API key validation
2. Rate limiting on endpoints
3. Use HTTPS (automatic on Render/Railway/Fly)

## Costs

- **Render Free**: Free, but goes to sleep after 15 min inactivity
- **Render Starter**: $7/month, always active
- **Railway**: Pay-as-you-go, ~$5-10/month for small app
- **Fly.io**: Free tier with limitations
- **Vercel**: Free for frontend

## Support

If you have problems, check:
1. Docker container logs
2. Vercel function logs
3. Browser developer console