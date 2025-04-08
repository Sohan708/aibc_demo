/**
 * Configuration loader utility
 */
const fs = require('fs');
const path = require('path');
const { getLogger } = require('./logger');

const logger = getLogger('config');

/**
 * Load configuration from the config.json file
 * @returns {Object} Configuration object
 */
function loadConfig() {
    try {
        const configPath = path.resolve(__dirname, '../../config/config.json');
        logger.info(`Loading configuration from ${configPath}`);
        
        // Check if configuration file exists
        if (!fs.existsSync(configPath)) {
            throw new Error(`Configuration file not found at ${configPath}`);
        }
        
        const configFile = fs.readFileSync(configPath, 'utf8');
        const config = JSON.parse(configFile);
        
        // Validate required configuration
        if (!config.pipe) {
            throw new Error('Missing required configuration: pipe section');
        }
        if (!config.server) {
            throw new Error('Missing required configuration: server section');
        }
        if (!config.threshold) {
            throw new Error('Missing required configuration: threshold section');
        }
        
        logger.info('Configuration loaded successfully');
        return config;
    } catch (error) {
        logger.error(`Failed to load configuration: ${error.message}`);
        logger.warn('Using default configuration');
    }
}

module.exports = { loadConfig };
