/**
 * Logger utility using log4js
 */
const fs = require('fs');
const path = require('path');
const log4js = require('log4js');

/**
 * Initialize the logger
 */
function initLogger() {
    try {
        // Create logs directory if it doesn't exist
        const logsDir = path.resolve(__dirname, '../../logs');
        if (!fs.existsSync(logsDir)) {
            fs.mkdirSync(logsDir, { recursive: true });
        }

        // Load log4js configuration from JSON file
        const configPath = path.resolve(__dirname, '../../config/log4js.json');

        if (fs.existsSync(configPath)) {
            log4js.configure(require(configPath));
            console.log('Loaded log4js configuration from file');
        } else {
            console.error('Log4js configuration file not found. Using default configuration.');
            // Fallback to default configuration if file not found
            log4js.configure({
                appenders: {
                    console: { type: 'console' },
                    file: { type: 'file', filename: path.join(logsDir, 'pipeReader.log') }
                },
                categories: {
                    default: { appenders: ['console', 'file'], level: 'info' }
                }
            });
        }

        // Set up global error handlers
        process.on('uncaughtException', (err) => {
            const logger = log4js.getLogger('system');
            logger.fatal(`Uncaught Exception: ${err.message}`, err);
            logger.fatal('Application will shut down due to uncaught exception');

            // Give logs time to flush to file before exiting
            setTimeout(() => process.exit(1), 1000);
        });

        process.on('unhandledRejection', (reason, promise) => {
            const logger = log4js.getLogger('system');
            logger.error(`Unhandled Promise Rejection: ${reason}`, { reason });
        });

        return log4js;
    } catch (error) {
        console.error('Failed to initialize logger:', error);
        process.exit(1);
    }
}

// Initialize and export the logger
const loggerInstance = initLogger();

module.exports = {
    getLogger: (category) => loggerInstance.getLogger(category || 'default')
};

