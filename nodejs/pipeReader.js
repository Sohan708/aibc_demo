/**
 * Pipe Reader module for reading data from the named pipe
 * This version includes proper logging and error handling
 */
const fs = require('fs');
const readline = require('readline');
const { execSync } = require('child_process');
const path = require('path');

// Import utilities and controllers
const { loadConfig } = require('./utils/config');
const { getLogger } = require('./utils/logger');

// Initialize logger
const logger = getLogger('pipeReader');

// Load configuration
const config = loadConfig();

// Initialize controllers
const temperatureController = require('./controllers/temperatureController')(config);
const alertController = require('./controllers/alertController')(config);

// Get pipe name from config
const pipeName = config.pipe.name;

// Variables for pipe reading
let fd = null;
let readStream = null;
let rl = null;

/**
 * Create named pipe if it doesn't exist
 */
function createNamedPipeIfNeeded() {
    try {
        if (!fs.existsSync(pipeName)) {
            try {
                execSync(`mkfifo ${pipeName}`);
                fs.chmodSync(pipeName, 0o660); // Set appropriate permissions
                logger.info(`Named pipe created: ${pipeName}`);
            } catch (error) {
                logger.fatal(`Failed to create named pipe: ${error.message}`, error);
                process.exit(1);
            }
        } else {
            logger.info(`Named pipe already exists: ${pipeName}`);
        }
    } catch (error) {
        logger.error(`Error checking pipe existence: ${error.message}`, error);
        throw error;
    }
}

/**
 * Clean up resources
 */
function cleanupResources() {
    try {
        if (rl) {
            try {
                rl.close();
            } catch (err) {
                logger.debug(`Error closing readline interface: ${err.message}`);
            }
            rl = null;
        }
        
        if (readStream) {
            try {
                readStream.destroy();
            } catch (err) {
                logger.debug(`Error destroying read stream: ${err.message}`);
            }
            readStream = null;
        }
        
        if (fd !== null) {
            try {
                fs.closeSync(fd);
            } catch (err) {
                logger.debug(`Error closing file descriptor: ${err.message}`);
            }
            fd = null;
        }
        
        logger.debug('Resources cleaned up');
    } catch (error) {
        logger.error(`Error cleaning up resources: ${error.message}`, error);
    }
}

/**
 * Process a line of data from the pipe
 * @param {string} line - Raw data from pipe
 */
function processLine(line) {
    try {
        logger.debug(`Processing line: ${line}`);
        
        // Regular expression to match the fields and temperature values
        const regex = /id:\s*(\S+),\s*date:\s*(\S+),\s*time:\s*(\S+:\S+:\S+:\S+),\s*PTAT:\s*([0-9.-]+)\s*\[degC\],\s*Temperature:\s*((?:[0-9.-]+\s*,\s*)+[0-9.-]+)\s*\[degC\]/;
        const match = line.match(regex);

        if (match) {
            // Extract values from the match
            const sensorId = match[1];
            const date = match[2];
            const time = match[3];
            const ptat = parseFloat(match[4]);
            const temperatureData = match[5].split(',').map(temp => parseFloat(temp.trim()));
            
            logger.info(`Parsed sensor data from sensor ${sensorId}: ${temperatureData.length} temperature readings`);
            
            // Create sensor data object
            const sensorData = {
                sensorId,
                date,
                time,
                ptat,
                temperatureData
            };
            
            // Analyze the temperature data
            const analysis = temperatureController.analyzeTemperatureData(temperatureData);
            
            // Create and send temperature document
            const temperatureRecord = temperatureController.createTemperatureRecord(sensorData, analysis);
            temperatureController.sendTemperatureData(temperatureRecord);
            
            // Check for alert state transitions and handle if needed
            alertController.checkAndHandleAlertTransition(
                sensorId, 
                analysis.isAbnormal, 
                sensorData, 
                analysis
            );
        } else {
            logger.error('Unable to parse sensor data, invalid format');
        }
    } catch (error) {
        logger.error(`Error processing data: ${error.message}`, error);
    }
}

/**
 * Function to open pipe and set up reader
 */
function openPipe() {
    try {
        logger.info(`Opening pipe for reading: ${pipeName}`);
        
        // Open pipe for reading
        fd = fs.openSync(pipeName, 'r');
        readStream = fs.createReadStream('', { fd });
        
        // Create readline interface
        rl = readline.createInterface({
            input: readStream,
            crlfDelay: Infinity,
        });
        
        // Process data line by line
        rl.on('line', (line) => {
            logger.info(`Received raw data: ${line}`);
            processLine(line);
        });
        
        // If pipe closes, try to reopen immediately
        readStream.on('close', () => {
            logger.warn('Pipe input ended, reconnecting immediately...');
            
            // Clean up resources and reopen right away
            cleanupResources();
            openPipe();
        });
        
        readStream.on('error', (err) => {
            logger.error(`Error reading from pipe: ${err.message}`, err);
            
            // Clean up resources and reopen right away
            cleanupResources();
            openPipe();
        });
        
        logger.info('Pipe reader ready and listening for data');
    } catch (error) {
        logger.error(`Error opening pipe: ${error.message}`, error);
        
        // If pipe doesn't exist yet, check again immediately in a loop
        // This prevents any delay in processing data
        setImmediate(openPipe);
    }
}

/**
 * Start the pipe reader
 */
function start() {
    try {
        logger.info('Starting pipe reader...');
        
        // Create pipe if needed
        createNamedPipeIfNeeded();
        
        // Start reading from pipe
        openPipe();
        
        // Handle process termination
        process.on('SIGINT', () => {
            logger.info('Shutting down...');
            cleanupResources();
            process.exit(0);
        });
        
        // Log process exit
        process.on('exit', (code) => {
            logger.info(`Process exited with code: ${code}`);
        });
        
        logger.info('Pipe reader started successfully');
        logger.info(`Temperature thresholds: min=${config.threshold.min}°C, max=${config.threshold.max}°C`);
    } catch (error) {
        logger.fatal(`Failed to start pipe reader: ${error.message}`, error);
        process.exit(1);
    }
}

// Export functions for use in other modules
module.exports = {
    start,
    cleanupResources,
    processLine
};
