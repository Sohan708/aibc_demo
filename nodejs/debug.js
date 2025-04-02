/**
 * Debug module for AIBC demo application
 * Similar to #ifdef in C, provides conditional debugging functionality
 */
const fs = require('fs');
const path = require('path');
const moment = require('moment');

// Debug configuration
const DEBUG = process.env.DEBUG === 'true' || false;
const DEBUG_DIR = process.env.DEBUG_DIR || path.join(__dirname, 'debug_logs');
const DEBUG_LEVEL = process.env.DEBUG_LEVEL || 'info'; // 'error', 'warn', 'info', 'verbose'

// Levels mapping for filtering (higher number = more verbose)
const LEVELS = {
    'error': 1,
    'warn': 2,
    'info': 3,
    'verbose': 4
};

// Create debug directory if it doesn't exist and DEBUG is enabled
if (DEBUG) {
    try {
        if (!fs.existsSync(DEBUG_DIR)) {
            fs.mkdirSync(DEBUG_DIR, { recursive: true });
            console.log(`[DEBUG] Created debug directory: ${DEBUG_DIR}`);
        }
    } catch (error) {
        console.error(`[DEBUG] Failed to create debug directory: ${error.message}`);
    }
}

/**
 * Log a debug message if debugging is enabled
 * @param {string} message - Message to log
 * @param {*} data - Optional data to include
 * @param {string} level - Log level ('error', 'warn', 'info', 'verbose')
 */
function log(message, data = null, level = 'info') {
    if (!DEBUG || LEVELS[level] > LEVELS[DEBUG_LEVEL]) return;

    const timestamp = moment().format('YYYY-MM-DD HH:mm:ss.SSS');
    const logEntry = `[${timestamp}] [${level.toUpperCase()}] ${message}${data ? ': ' + JSON.stringify(data, null, 2) : ''}`;
    
    console.log(`[DEBUG] ${logEntry}`);
    
    // Write to log file if debug is enabled
    if (DEBUG) {
        try {
            const logFilePath = path.join(DEBUG_DIR, `${moment().format('YYYY-MM-DD')}.log`);
            fs.appendFileSync(logFilePath, logEntry + '\n');
        } catch (error) {
            console.error(`[DEBUG] Failed to write to log file: ${error.message}`);
        }
    }
}

/**
 * Save debug data to a file
 * @param {string} filename - Name of the file to save
 * @param {*} data - Data to save
 */
function saveData(filename, data) {
    if (!DEBUG) return;
    
    try {
        const filePath = path.join(DEBUG_DIR, filename);
        
        // If data is an object, stringify it
        const fileContent = typeof data === 'object' ? 
            JSON.stringify(data, null, 2) : 
            String(data);
            
        fs.writeFileSync(filePath, fileContent);
        log(`Saved debug data to ${filePath}`, null, 'info');
    } catch (error) {
        console.error(`[DEBUG] Failed to save debug data: ${error.message}`);
    }
}

/**
 * Start timing an operation for performance debugging
 * @param {string} label - Label for the timer
 * @returns {Function} Function to call when operation completes
 */
function startTimer(label) {
    if (!DEBUG) return () => {};
    
    const startTime = process.hrtime();
    
    return () => {
        const endTime = process.hrtime(startTime);
        const duration = (endTime[0] * 1000) + (endTime[1] / 1000000);
        log(`Timer [${label}] completed in ${duration.toFixed(2)}ms`, null, 'verbose');
        return duration;
    };
}

/**
 * Create a debug capture point - executes a function only when debugging is enabled
 * @param {Function} fn - Function to execute in debug mode
 * @returns {*} Result of function or undefined if DEBUG is false
 */
function capture(fn) {
    if (!DEBUG) return;
    return fn();
}

module.exports = {
    // Main debug flag - similar to #ifdef DEBUG in C
    enabled: DEBUG,
    
    // Debug directory 
    dir: DEBUG_DIR,
    
    // Logging functions
    log,
    error: (message, data) => log(message, data, 'error'),
    warn: (message, data) => log(message, data, 'warn'),
    info: (message, data) => log(message, data, 'info'),
    verbose: (message, data) => log(message, data, 'verbose'),
    
    // Data storage
    saveData,
    
    // Performance measurement
    startTimer,
    
    // Conditional execution (like #ifdef)
    capture
};
