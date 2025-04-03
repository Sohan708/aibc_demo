/**
 * Simple Pipe Reader module for reading data from the named pipe
 * All configuration is included directly in this file
 */
const fs = require('fs');
const readline = require('readline');
const axios = require('axios');
const { execSync } = require('child_process');

// Configuration constants
const pipeName = '/tmp/sensor_data_pipe';
const temperatureApiUrl = 'http://192.168.5.104:3000/api/data';
const alertsApiUrl = 'http://192.168.5.104:3000/api/alerts';
const minNormalTemp = 20.0;  // Minimum normal temperature (Celsius)
const maxNormalTemp = 70.0;  // Maximum normal temperature (Celsius)

// Create named pipe if it doesn't exist
if (!fs.existsSync(pipeName)) {
    try {
        execSync(`mkfifo ${pipeName}`);
        fs.chmodSync(pipeName, 0o660); // Set appropriate permissions
        console.log(`Named pipe created: ${pipeName}`);
    } catch (error) {
        console.error(`Failed to create named pipe: ${error.message}`);
        process.exit(1);
    }
} else {
    console.log(`Named pipe already exists: ${pipeName}`);
}

// Variables for pipe reading
let fd = null;
let readStream = null;
let rl = null;

// Function to open pipe and set up reader
function openPipe() {
    try {
        console.log(`Opening pipe for reading: ${pipeName}`);
        
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
            console.log(`Received: ${line}`);
            processLine(line);
        });
        
        // If pipe closes, try to reopen immediately
        readStream.on('close', () => {
            console.log('Pipe input ended, reconnecting immediately...');
            
            // Clean up resources and reopen right away
            cleanupResources();
            openPipe();
        });
        
        readStream.on('error', (err) => {
            console.error('Error reading from pipe:', err.message);
            
            // Clean up resources and reopen right away
            cleanupResources();
            openPipe();
        });
        
        console.log('Pipe reader ready');
    } catch (error) {
        console.error(`Error opening pipe: ${error.message}`);
        
        // If pipe doesn't exist yet, check again immediately in a loop
        // This prevents any delay in processing data
        setImmediate(openPipe);
    }
}

// Clean up resources
function cleanupResources() {
    if (rl) {
        try {
            rl.close();
        } catch (err) {
            // Ignore errors on close
        }
        rl = null;
    }
    
    if (readStream) {
        try {
            readStream.destroy();
        } catch (err) {
            // Ignore errors on destroy
        }
        readStream = null;
    }
    
    if (fd !== null) {
        try {
            fs.closeSync(fd);
        } catch (err) {
            // Ignore errors on close
        }
        fd = null;
    }
}

// Start reading from pipe
openPipe();

// Track alert state for each sensor to detect changes
const sensorAlertState = {};

/**
 * Get current date and time formatted
 * @returns {Object} - Formatted date and time
 */
function getCurrentDateTime() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    const milliseconds = String(now.getMilliseconds()).padStart(3, '0');
    
    return {
        date: `${year}/${month}/${day}`,
        time: `${hours}:${minutes}:${seconds}.${milliseconds}`,
        created_at: `${year}/${month}/${day} ${hours}:${minutes}:${seconds}.${milliseconds}`
    };
}

/**
 * Send temperature data to API
 * @param {Object} data - Temperature data to send
 */
async function sendTemperatureData(data) {
    try {
        const response = await axios.post(temperatureApiUrl, data);
        console.log(`Temperature data sent successfully: ${response.status} ${response.statusText}`);
    } catch (error) {
        if (error.response) {
            console.error(`Failed to send temperature data: ${error.response.status} ${error.response.statusText}`);
        } else {
            console.error(`Error sending temperature data: ${error.message}`);
        }
    }
}

/**
 * Send alert data to API
 * @param {Object} data - Alert data to send
 */
async function sendAlertData(data) {
    try {
        const response = await axios.post(alertsApiUrl, data);
        console.log(`Alert data sent successfully: ${response.status} ${response.statusText}`);
    } catch (error) {
        if (error.response) {
            console.error(`Failed to send alert data: ${error.response.status} ${error.response.statusText}`);
        } else {
            console.error(`Error sending alert data: ${error.message}`);
        }
    }
}

/**
 * Analyze temperature data for anomalies
 * @param {Array} temperatureData - Array of temperature readings
 * @returns {Object} - Analysis result
 */
function analyzeTemperatureData(temperatureData) {
    const maxTemp = Math.max(...temperatureData);
    const minTemp = Math.min(...temperatureData);
    const avgTemp = temperatureData.reduce((sum, temp) => sum + temp, 0) / temperatureData.length;
    
    let isAbnormal = false;
    let alertReason = '';
    
    // Check for temperature out of normal range
    if (maxTemp > maxNormalTemp) {
        isAbnormal = true;
        alertReason = `温度が ${maxNormalTemp}°C超えました`;
    } else if (minTemp < minNormalTemp) {
        isAbnormal = true;
        alertReason = `温度が ${minNormalTemp}°C未満になりました`;
    }
    
    return {
        isAbnormal,
        alertReason,
        avgTemp
    };
}

// Function to process a line of data
function processLine(line) {
    console.log(`Received: ${line}`);
    
    try {
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
            
            // Analyze the temperature data
            const analysis = analyzeTemperatureData(temperatureData);
            
            // Create temperature document
            const temperatureRecord = {
                sensor_id: sensorId,
                date: date,
                time: time,
                temperature_data: temperatureData,
                average_temp: analysis.avgTemp,
                status: analysis.isAbnormal ? '１：異常' : '0 ：正常',
            };
            
            // Send temperature data to API
            sendTemperatureData(temperatureRecord);
            
            // Check for state transitions (normal to alert or alert to normal)
            const previousState = sensorAlertState[sensorId] || false;
            const currentState = analysis.isAbnormal;
            
            // If the alert state has changed, send an alert
            if (currentState !== previousState) {
                // Create alert document
                const alertRecord = {
                    sensor_id: sensorId,
                    date: date,
                    time: time,
                    alert_reason: analysis.isAbnormal ? analysis.alertReason : '温度が正常範囲に戻りました',
                    status: 'alert',
                };
                
                // Send alert to API
                sendAlertData(alertRecord);
                
                // Log the alert or recovery
                if (analysis.isAbnormal) {
                    console.log(`⚠️ ALERT: ${alertRecord.alert_reason} for sensor ${alertRecord.sensor_id}`);
                } else {
                    console.log(`✅ RECOVERY: Temperature returned to normal for sensor ${alertRecord.sensor_id}`);
                }
                
                // Update the sensor state
                sensorAlertState[sensorId] = currentState;
            }
        } else {
            console.error('Unable to parse sensor data');
        }
    } catch (error) {
        console.error('Error processing data:', error.message);
    }
}



// Handle process termination
process.on('SIGINT', () => {
    console.log('Shutting down...');
    cleanupResources();
    process.exit(0);
});

// Keep the process running
process.on('exit', (code) => {
    console.log(`Process exited with code: ${code}`);
});

console.log('Simple pipe reader started successfully');
