/**
 * API Client module for sending sensor data to MongoDB with anomaly detection
 */
const { MongoClient } = require('mongodb');
const config = require('./config');
const { 
    detectAnomalies, 
    createTemperatureDocument, 
    createAlertDocument 
} = require('./schema');

// Buffer to store data if MongoDB is unavailable
let dataBuffer = [];
let isProcessing = false;
let mongoClient = null;
let temperatureCollection = null;
let alertsCollection = null;

// Track alert state for each sensor
const sensorAlertState = {};

/**
 * Initialize MongoDB connection
 */
async function initializeMongoDB() {
    try {
        mongoClient = new MongoClient(config.mongodb.uri);
        await mongoClient.connect();
        console.log('Connected to MongoDB Atlas successfully');
        
        const db = mongoClient.db(config.mongodb.dbName);
        temperatureCollection = db.collection(config.mongodb.temperatureCollection);
        alertsCollection = db.collection(config.mongodb.alertsCollection);
        
        // Create indexes for better performance
        await temperatureCollection.createIndex({ "sensor_id": 1, "date": 1, "time": 1 });
        await alertsCollection.createIndex({ "sensor_id": 1, "date": 1, "time": 1 });
        
        console.log('MongoDB collections and indexes initialized');
    } catch (error) {
        console.error('Failed to connect to MongoDB:', error.message);
    }
}

// Initialize MongoDB connection when the module is loaded
initializeMongoDB();

/**
 * Process sensor data, detect anomalies, and save to MongoDB
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
        
        // Add to MongoDB temperature_readings collection
        await addToMongoDB(temperatureRecord);
        
        // Handle alert state transitions
        if (currentState !== previousState) {
            // Create alert or recovery log document
            const alertRecord = createAlertDocument(
                data, 
                anomalyResult.isAbnormal,
                anomalyResult.isAbnormal ? anomalyResult.anomalyReason : '温度が正常範囲に戻りました'
            );
            
            // Record the state change in the alerts_log collection
            await addAlertToMongoDB(alertRecord);
            
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
 * Add data to MongoDB with retry mechanism
 * @param {Object} data - Data to add to MongoDB
 * @param {number} retry - Current retry attempt
 */
async function addToMongoDB(data, retry = 0) {
    if (isProcessing) {
        // If already processing, add to buffer
        dataBuffer.push({ collection: 'temperature', data });
        return;
    }
    
    isProcessing = true;
    
    try {
        if (!temperatureCollection) {
            if (retry === 0) {
                // Try to reinitialize MongoDB
                await initializeMongoDB();
            }
            
            if (!temperatureCollection) {
                throw new Error('MongoDB temperature collection not available');
            }
        }
        
        // Insert the data into MongoDB
        const result = await temperatureCollection.insertOne(data);
        
        console.log(`Successfully saved temperature data for sensor ${data.sensor_id} at ${data.date} ${data.time}`);
        
        // Process buffer
        await processBuffer();
        
    } catch (error) {
        console.error(`Error sending data to MongoDB (attempt ${retry + 1}/${config.api.retryLimit}):`, error.message);
        
        // Retry logic
        if (retry < config.api.retryLimit) {
            console.log(`Retrying in ${config.api.retryDelay}ms...`);
            setTimeout(() => addToMongoDB(data, retry + 1), config.api.retryDelay);
        } else {
            console.error('Max retry attempts reached. Adding data to buffer.');
            dataBuffer.push({ collection: 'temperature', data });
        }
    } finally {
        isProcessing = false;
    }
}

/**
 * Add alert event to MongoDB with retry mechanism
 * @param {Object} data - Alert data to add to MongoDB
 * @param {number} retry - Current retry attempt
 */
async function addAlertToMongoDB(data, retry = 0) {
    try {
        if (!alertsCollection) {
            if (retry === 0) {
                // Try to reinitialize MongoDB
                await initializeMongoDB();
            }
            
            if (!alertsCollection) {
                throw new Error('MongoDB alerts collection not available');
            }
        }
        
        // Insert the alert into MongoDB
        const result = await alertsCollection.insertOne(data);
        
        console.log(`Successfully saved ${data.status} alert for sensor ${data.sensor_id} at ${data.date} ${data.time}`);
        return true;
    } catch (error) {
        console.error(`Error sending alert to MongoDB (attempt ${retry + 1}/${config.api.retryLimit}):`, error.message);
        
        // Retry logic
        if (retry < config.api.retryLimit) {
            console.log(`Retrying in ${config.api.retryDelay}ms...`);
            await new Promise(resolve => setTimeout(resolve, config.api.retryDelay));
            return addAlertToMongoDB(data, retry + 1);
        } else {
            console.error('Max retry attempts reached for alert.');
            dataBuffer.push({ collection: 'alerts', data });
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
            if (bufferItem.collection === 'temperature') {
                await temperatureCollection.insertOne(bufferItem.data);
                console.log(`Successfully processed buffered temperature data for sensor ${bufferItem.data.sensor_id}`);
            } else if (bufferItem.collection === 'alerts') {
                await alertsCollection.insertOne(bufferItem.data);
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
 * Close MongoDB connection when shutting down
 */
function closeMongoDB() {
    if (mongoClient) {
        console.log('Closing MongoDB connection...');
        mongoClient.close();
    }
}

/**
 * Get the status of the data buffer and MongoDB connection
 * @returns {Object} Status information
 */
function getStatus() {
    return {
        bufferedData: dataBuffer.length,
        isProcessing,
        mongoConnected: !!temperatureCollection,
        sensorAlertsActive: Object.entries(sensorAlertState)
            .filter(([_, isAlerted]) => isAlerted)
            .map(([sensorId, _]) => sensorId)
    };
}

module.exports = {
    processData,
    getStatus,
    closeMongoDB
};
