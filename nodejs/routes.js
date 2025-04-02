/**
 * API routes for the server
 */
const express = require('express');
const router = express.Router();
const { MongoClient } = require('mongodb');
const config = require('./config');
const apiClient = require('./apiClient');
const moment = require('moment');
const { getCurrentDateTime } = require('./schema');

// MongoDB client reference
let mongoClient = null;
let db = null;
let temperatureCollection = null;
let alertsCollection = null;

// Initialize MongoDB connection
async function initMongo() {
    if (!mongoClient) {
        try {
            mongoClient = new MongoClient(config.mongodb.uri);
            await mongoClient.connect();
            console.log('Routes connected to MongoDB');
            
            db = mongoClient.db(config.mongodb.dbName);
            temperatureCollection = db.collection(config.mongodb.temperatureCollection);
            alertsCollection = db.collection(config.mongodb.alertsCollection);
        } catch (error) {
            console.error('Error connecting to MongoDB from routes:', error.message);
        }
    }
}

// Initialize when module is loaded
initMongo();

// API status endpoint
router.get('/status', (req, res) => {
    const status = apiClient.getStatus();
    
    res.json({
        status: 'running',
        bufferedData: status.bufferedData,
        isProcessing: status.isProcessing,
        mongoConnected: status.mongoConnected,
        activeAlerts: status.sensorAlertsActive,
        lastUpdated: getCurrentDateTime().created_at
    });
});

// Get temperature readings (most recent first)
router.get('/temperature-data', async (req, res) => {
    try {
        if (!temperatureCollection) {
            await initMongo();
            if (!temperatureCollection) {
                return res.status(500).json({ error: 'MongoDB not connected' });
            }
        }
        
        const limit = parseInt(req.query.limit) || 20;
        const sensor = req.query.sensor || null;
        const date = req.query.date || null; // Format: YYYY/MM/DD
        
        const query = {};
        if (sensor) query.sensor_id = sensor;
        if (date) query.date = date;
        
        const readings = await temperatureCollection
            .find(query)
            .sort({ date: -1, time: -1 })
            .limit(limit)
            .toArray();
            
        res.json(readings);
    } catch (error) {
        console.error('Error fetching temperature data:', error.message);
        res.status(500).json({ error: 'Error fetching temperature data' });
    }
});

// Get alert events (most recent first)
router.get('/alerts', async (req, res) => {
    try {
        if (!alertsCollection) {
            await initMongo();
            if (!alertsCollection) {
                return res.status(500).json({ error: 'MongoDB not connected' });
            }
        }
        
        const limit = parseInt(req.query.limit) || 20;
        const sensor = req.query.sensor || null;
        const status = req.query.status || null; // 'active' or 'recovered'
        const date = req.query.date || null; // Format: YYYY/MM/DD
        
        const query = {};
        if (sensor) query.sensor_id = sensor;
        if (status) query.status = status;
        if (date) query.date = date;
        
        const alerts = await alertsCollection
            .find(query)
            .sort({ date: -1, time: -1 })
            .limit(limit)
            .toArray();
            
        res.json(alerts);
    } catch (error) {
        console.error('Error fetching alerts:', error.message);
        res.status(500).json({ error: 'Error fetching alerts' });
    }
});

// Manually submit a temperature reading (for testing)
router.post('/temperature-data', async (req, res) => {
    try {
        const data = req.body;
        
        if (!data || !data.temperature_data || !Array.isArray(data.temperature_data)) {
            return res.status(400).json({ error: 'Invalid temperature data. Must include temperature_data array.' });
        }
        
        // Ensure sensor_id is present
        if (!data.sensor_id) {
            data.sensor_id = 'D6T-001'; // Default sensor ID
        }
        
        // Current timestamp will be added in the processData function
        
        // Process the data
        await apiClient.processData(data);
        
        res.json({ 
            success: true, 
            message: 'Temperature data submitted successfully'
        });
    } catch (error) {
        console.error('Error submitting temperature data:', error.message);
        res.status(500).json({ error: 'Error processing temperature data' });
    }
});

module.exports = router;
