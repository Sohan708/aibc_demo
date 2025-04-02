/**
 * API Client module for sending sensor data to API server with anomaly detection
 */
const axios = require('axios');
const config = require('./config');
const moment = require('moment');

// Buffer to store data if API server is unavailable
let dataBuffer = [];
let isProcessing = false;

// Track alert state for each sensor
const sensorAlertState = {};

/**
 * Get current date and time formatted
 * @returns {Object} - Formatted date and time
 */
function getCurrentDateTime() {
    const momentDate = moment(new Date());
    return {
        date: momentDate.format('YYYY/MM/DD'),
        time: momentDate.format('HH:mm:ss.SSS'),
        created_at: momentDate.format('YYYY/MM/DD HH:mm:ss.SSS')
    };
}

/**
 * Check if temperature data contains anomalies
 * @param {Array} temperatureData - Array of temperature readings
 * @returns {Object} - Anomaly detection result
 */
function detectAnomalies(temperatureData) {
    let isAbnormal = false;
    let anomalyReason = '';
    
    // Check for too low temperatures
    const minTemp = Math.min(...temperatureData);
    if (minTemp < config.temperature.minNormal) {
        isAbnormal = true;
        anomalyReason = `温度が ${config.temperature.minNormal}°C未満になりました`;
    }
    
    // Check for too high temperatures
    const maxTemp = Math.max(...temperatureData);
    if (maxTemp > config.temperature.maxNormal) {
        isAbnormal = true;
        anomalyReason = `温度が ${config.temperature.maxNormal}°C超えました`;
    }
    
    return {
        isAbnormal,
        anomalyReason
    };
}

/**
 * Create temperature document
 * @param {Object} data - Raw sensor data
 * @param {boolean} isAbnormal - Whether an anomaly was detected
 * @returns {Object} - Formatted temperature document
 */
function createTemperatureDocument(data, isAbnormal) {
    const dateTime = getCurrentDateTime();
    
    return {
        sensor_id: data.sensor_id || 'D6T-001',
        date: dateTime.date,
        time: dateTime.time,
        temperature_data: data.temperature_data,
        average_temp: data.temperature_data.reduce((sum, temp) => sum + temp, 0) / data.temperature_data.length,
        status: isAbnormal ? 'alert' : 'normal',
        created_at: dateTime.created_at
    };
}

/**
 * Create alert document
 * @param {Object} data - Raw sensor data
 * @param {boolean} isAbnormal - Whether an anomaly was detected
 * @param {string} reason - Reason for the alert
 * @returns {Object} - Formatted alert document
 */
function createAlertDocument(data, isAbnormal, reason) {
    const dateTime = getCurrentDateTime();
    
    return {
        sensor_id: data.sensor_id || 'D6T-001',
        date: dateTime.date,
        time: dateTime.time,
        alert_reason: reason,
        status: isAbnormal ? 'alert' : 'normal',
        created_at: dateTime.created_at
    };
}

/**
 * Process sensor data, detect anomalies, and send to API server
 * @param {Object} rawData - Raw sensor data
 */
async function processData(rawData) {
    try {
        // Parse or format the data properly
        const data = typeof rawData === 'string' ? JSON.parse(rawData) : rawData;
        
        // Ensure temperature_data is an array
        if (!Array.isArray(data.temperature_data) && typeof data.temperature !== 'undefined') {
            // Convert single temperature value to array if needed
            data.temperature_data = [data.temperature];
        } else if (!Array.isArray(data.temperature_data)) {
            console.error('No temperature data found in the payload');
            return;
        }
        
        // Detect anomalies
        const anomalyResult = detectAnomalies(data.temperature_data);
        
        // Check for state transitions (normal to alert or alert to normal)
        const previousState = sensorAlertState[data.sensor_id || 'D6T-001'] || false;
        const currentState = anomalyResult.isAbnormal;
        
        // Create temperature document using schema
        const temperatureRecord = createTemperatureDocument(data, anomalyResult.isAbnormal);
        
        // Send to API server
        await sendDataToAPI(temperatureRecord);
        
        // Handle alert state transitions
        if (currentState !== previousState) {
            // Create alert or recovery log document
            const alertRecord = createAlertDocument(
                data, 
                anomalyResult.isAbnormal,
                anomalyResult.isAbnormal ? anomalyResult.anomalyReason : '温度が正常範囲に戻りました'
            );
            
            // Send alert to API server
            await sendAlertToAPI(alertRecord);
            
            // Log the alert or recovery
            if (anomalyResult.isAbnormal) {
                console.log(`⚠️ ALERT: ${alertRecord.alert_reason} for sensor ${alertRecord.sensor_id}`);
            } else {
                console.log(`✅ RECOVERY: Temperature returned to normal for sensor ${alertRecord.sensor_id}`);
            }
            
            // Update the sensor state
            sensorAlertState[alertRecord.sensor_id] = currentState;
        }
        
    } catch (error) {
        console.error('Error processing sensor data:', error.message);
    }
}

/**
 * Send data to API server with retry mechanism
 * @param {Object} data - Data to send to API server
 * @param {number} retry - Current retry attempt
 */
async function sendDataToAPI(data, retry = 0) {
    if (isProcessing) {
        // If already processing, add to buffer
        dataBuffer.push({ type: 'temperature', data });
        return;
    }
    
    isProcessing = true;
    
    try {
        // Send the data to API server
        const response = await axios.post(config.api.url, data);
        
        console.log(`Successfully sent temperature data for sensor ${data.sensor_id} at ${data.date} ${data.time}`);
        
        // Process buffer
        await processBuffer();
        
    } catch (error) {
        const errorMessage = error.response ? 
            `API returned ${error.response.status}: ${error.response.statusText}` : 
            error.message;
            
        console.error(`Error sending data to API (attempt ${retry + 1}/${config.api.retryLimit}):`, errorMessage);
        
        // Retry logic
        if (retry < config.api.retryLimit) {
            console.log(`Retrying in ${config.api.retryDelay}ms...`);
            setTimeout(() => sendDataToAPI(data, retry + 1), config.api.retryDelay);
        } else {
            console.error('Max retry attempts reached. Adding data to buffer.');
            dataBuffer.push({ type: 'temperature', data });
        }
    } finally {
        isProcessing = false;
    }
}

/**
 * Send alert to API server with retry mechanism
 * @param {Object} data - Alert data to send to API server
 * @param {number} retry - Current retry attempt
 */
async function sendAlertToAPI(data, retry = 0) {
    try {
        // Create alerts endpoint URL by appending '/alerts' to base URL
        const alertsUrl = config.api.url.replace('/temperature-data', '/alerts');
        
        // Send the alert to API server
        const response = await axios.post(alertsUrl, data);
        
        console.log(`Successfully sent ${data.status} alert for sensor ${data.sensor_id} at ${data.date} ${data.time}`);
        return true;
    } catch (error) {
        const errorMessage = error.response ? 
            `API returned ${error.response.status}: ${error.response.statusText}` : 
            error.message;
            
        console.error(`Error sending alert to API (attempt ${retry + 1}/${config.api.retryLimit}):`, errorMessage);
        
        // Retry logic
        if (retry < config.api.retryLimit) {
            console.log(`Retrying in ${config.api.retryDelay}ms...`);
            await new Promise(resolve => setTimeout(resolve, config.api.retryDelay));
            return sendAlertToAPI(data, retry + 1);
        } else {
            console.error('Max retry attempts reached for alert.');
            dataBuffer.push({ type: 'alert', data });
            return false;
        }
    }
}

/**
 * Process buffered data items
 */
async function processBuffer() {
    if (dataBuffer.length === 0) {
        return;
    }
    
    console.log(`Processing buffered data. Items in buffer: ${dataBuffer.length}`);
    
    while (dataBuffer.length > 0) {
        const bufferItem = dataBuffer.shift();
        
        try {
            if (bufferItem.type === 'temperature') {
                await axios.post(config.api.url, bufferItem.data);
                console.log(`Successfully processed buffered temperature data for sensor ${bufferItem.data.sensor_id}`);
            } else if (bufferItem.type === 'alert') {
                const alertsUrl = config.api.url.replace('/temperature-data', '/alerts');
                await axios.post(alertsUrl, bufferItem.data);
                console.log(`Successfully processed buffered alert for sensor ${bufferItem.data.sensor_id}`);
            }
        } catch (error) {
            console.error('Error processing buffer item:', error.message);
            // Put the item back at the beginning of the buffer
            dataBuffer.unshift(bufferItem);
            break;
        }
    }
    
    if (dataBuffer.length === 0) {
        console.log('Buffer empty.');
    }
}

/**
 * Get the status of the data buffer
 * @returns {Object} Status information
 */
function getStatus() {
    return {
        bufferedData: dataBuffer.length,
        isProcessing,
        apiUrl: config.api.url,
        sensorAlertsActive: Object.entries(sensorAlertState)
            .filter(([_, isAlerted]) => isAlerted)
            .map(([sensorId, _]) => sensorId)
    };
}

module.exports = {
    processData,
    getStatus
};
