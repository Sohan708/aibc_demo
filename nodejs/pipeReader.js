/**
 * Pipe Reader module for reading data from the named pipe
 */
const fs = require('fs');
const readline = require('readline');
const config = require('./config');
const apiClient = require('./apiClient');

let fd = null;
let readStream = null;
let rl = null;

/**
 * Set up the reader for the named pipe
 */
function setupPipeReader() {
    console.log(`Setting up pipe reader for ${config.pipe}`);
    
    try {
        // Check if pipe exists
        if (!fs.existsSync(config.pipe)) {
            console.log(`Pipe ${config.pipe} does not exist. Waiting for it to be created...`);
            setTimeout(setupPipeReader, 5000);
            return;
        }
        
        // Open the named pipe in read-only mode
        fd = fs.openSync(config.pipe, 'r');
        readStream = fs.createReadStream(null, { fd });
        console.log('Pipe reader created successfully');
        
        // Create a readline interface
        rl = readline.createInterface({
            input: readStream,
            crlfDelay: Infinity,
        });
        
        // Process line by line
        rl.on('line', (line) => {
            try {
                // Log the raw data
                console.log('Raw data received:', line);
                
                // Regular expression to match the fields and temperature values
                const regex = /id:\s*(\S+),\s*date:\s*(\S+),\s*time:\s*(\S+:\S+:\S+:\S+),\s*PTAT:\s*([0-9.-]+)\s*\[degC\],\s*Temperature:\s*((?:[0-9.-]+\s*,\s*)+[0-9.-]+)\s*\[degC\]/;
                const match = line.match(regex);
        
                if (match) {
                    // Extract values from the match
                    const sensorData = {
                        sensor_id: match[1],
                        date: match[2],
                        time: match[3],
                        PTAT: parseFloat(match[4]),
                        temperature_data: match[5].split(',').map(temp => parseFloat(temp.trim()))
                    };
                    
                    // Process the data
                    apiClient.processData(sensorData);
                } else {
                    throw new Error('Unable to parse sensor data');
                }
            } catch (error) {
                console.error('Error processing sensor data:', error.message);
            }
        });
        
        // Handle pipe closure
        rl.on('close', () => {
            console.log('Pipe closed. Reopening...');
            closePipeReader();
            // Try to reestablish connection after delay
            setTimeout(setupPipeReader, 5000);
        });
        
        readStream.on('error', (err) => {
            console.error('Error reading from pipe:', err);
            closePipeReader();
            // Try to reestablish connection after delay
            setTimeout(setupPipeReader, 5000);
        });
        
    } catch (err) {
        console.error('Error setting up pipe reader:', err);
        setTimeout(setupPipeReader, 5000);
    }
}

/**
 * Close the pipe reader
 */
function closePipeReader() {
    if (rl) {
        rl.close();
        rl = null;
    }
    
    if (readStream) {
        readStream.close();
        readStream = null;
    }
    
    if (fd !== null) {
        try {
            fs.closeSync(fd);
            console.log('Pipe closed successfully');
        } catch (err) {
            console.error('Error closing pipe:', err);
        }
        fd = null;
    }
    
    // Close MongoDB connection
    apiClient.closeMongoDB();
}

module.exports = {
    setupPipeReader,
    closePipeReader
};

// Initialize pipe reader when module is loaded
setupPipeReader();
