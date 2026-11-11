import { app } from './app.js';
import { config } from './config/env.js';
import { connectDB } from './config/db.js';

// ANSI escape codes for clean, consistent terminal output
const CYAN = '\x1b[36m';
const BOLD = '\x1b[1m';
const RESET = '\x1b[0m';

async function startServer() {
  console.log(`${BOLD}${CYAN}[SARTHI]${RESET} Initializing SARTHI Personal Execution & Student Operating System...`);
  
  // Connect to database
  await connectDB();

  const server = app.listen(config.port, () => {
    console.log(`${BOLD}${CYAN}[SARTHI]${RESET} Server is actively running on ${BOLD}http://localhost:${config.port}${RESET}`);
    console.log(`${BOLD}${CYAN}[SARTHI]${RESET} Environment: ${config.nodeEnv} | Timezone: ${config.timezone}`);
  });

  const handleShutdown = () => {
    console.log(`\n${BOLD}${CYAN}[SARTHI]${RESET} Gracefully stopping server...`);
    server.close(() => {
      console.log(`${BOLD}${CYAN}[SARTHI]${RESET} Server stopped.`);
      process.exit(0);
    });
  };

  process.on('SIGTERM', handleShutdown);
  process.on('SIGINT', handleShutdown);
}

startServer();
