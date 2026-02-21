/**
 * PM2 Ecosystem Config
 *
 * Start everything:   pm2 start ecosystem.config.js
 * Worker only:        pm2 start ecosystem.config.js --only ai-worker
 * Web only:           pm2 start ecosystem.config.js --only ai-web
 * Logs:               pm2 logs
 * Monitor:            pm2 monit
 * Save process list:  pm2 save
 * Startup script:     pm2 startup
 */

module.exports = {
  apps: [
    {
      name: 'ai-web',
      script: 'node_modules/.bin/next',
      args: 'start',
      cwd: __dirname,
      instances: 1,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 3000,
      watch: false,
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
    },
    {
      name: 'ai-worker',
      script: 'node_modules/.bin/tsx',
      args: 'workers/job-worker.ts',
      cwd: __dirname,
      instances: 1,          // Single worker — DB locking prevents double-execution
      autorestart: true,
      max_restarts: 20,
      restart_delay: 5000,   // 5s between restarts
      watch: false,
      kill_timeout: 35000,   // Grace period > worker's 30s shutdown wait
      env: {
        NODE_ENV: 'production',
        // Supabase — set these in your shell or a .env.production file
        // NEXT_PUBLIC_SUPABASE_URL: '',
        // SUPABASE_SERVICE_ROLE_KEY: '',
        // AI providers
        // OPENAI_API_KEY: '',
        // Worker tuning
        WORKER_POLL_INTERVAL_MS: '5000',
        WORKER_MAX_CONCURRENT_JOBS: '3',
        WORKER_JOB_TIMEOUT_MS: '300000',
        WORKER_STUCK_JOB_TIMEOUT_MINUTES: '30',
        WORKER_REAP_INTERVAL_MS: '300000',
        DEFAULT_LLM_PROVIDER: 'openai',
        DEFAULT_LLM_MODEL: 'gpt-4o-mini',
      },
    },
  ],
};
