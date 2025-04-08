/**
 * Main entry point for the AIBC Demo application
 * This server reads temperature data from a named pipe and sends it to an API
 */
const path = require('path');

// Initialize logger first
const { getLogger } = require('./utils/logger');
const logger = getLogger('server');

// Log startup
logger.info('========================================');
logger.info('Starting AIBC Demo application...');
logger.info(`Process ID: ${process.pid}`);
logger.info(`Working directory: ${process.cwd()}`);
logger.info(`Node.js version: ${process.version}`);
logger.info('========================================');

try {
    // Import the pipe reader module
    const pipeReader = require('./pipeReader.js');
    
    // Start the pipe reader
    pipeReader.start();
    
    // Export for testing and scripting
    module.exports = {
        pipeReader
    };
    
    // Log successful startup
    logger.info('Application initialized successfully');
    
} catch (error) {
    logger.fatal(`Failed to initialize application: ${error.message}`, error);
    process.exit(1);
}

// Future Express server setup for API endpoints could be added here
