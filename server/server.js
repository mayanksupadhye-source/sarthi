import { app } from './app.js';
import { config } from './config/env.js';
import { connectDB } from './config/db.js';

async function startServer() {
  console.log(`[SARTHI] Initializing SARTHI Personal Execution & Student Operating System...`);
  
  // Connect to database
  await connectDB();

  const server = app.listen(config.port, () => {
    console.log(`[SARTHI] Server is actively running on http://localhost:${config.port}`);
    console.log(`[SARTHI] Environment: ${config.nodeEnv} | Timezone: ${config.timezone}`);
  });

  const handleShutdown = () => {
    console.log('[SARTHI] Gracefully stopping server...');
    server.close(() => {
      console.log('[SARTHI] Server stopped.');
      process.exit(0);
    });
  };

  process.on('SIGTERM', handleShutdown);
  process.on('SIGINT', handleShutdown);
}

startServer();
