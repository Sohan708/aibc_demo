/**
 * API routes for the server
 */
const express = require('express');
const router = express.Router();
const config = require('./config');
const apiClient = require('./apiClient');
const moment = require('moment');

/**
 * Get current date and time formatted
 * @returns {Object} - Formatted current date and time
 */
function getCurrentDateTime() {
    const momentDate = moment(new Date());
    return {
        date: momentDate.format('YYYY/MM/DD'),
        time: momentDate.format('HH:mm:ss.SSS'),
        created_at: momentDate.format('YYYY/MM/DD HH:mm:ss.SSS')
    };
}

// API status endpoint
router.get('/status', (req, res) => {
    const status = apiClient.getStatus();
    
    res.json({
        status: 'running',
        bufferedData: status.bufferedData,
        isProcessing: status.isProcessing,
        apiEndpoint: status.apiUrl,
        activeAlerts: status.sensorAlertsActive,
        lastUpdated: getCurrentDateTime().created_at
    });
});

// Get temperature readings 
router.get('/temperature-data', async (req, res) => {
    try {
        // Since we're no longer using MongoDB, we return a message indicating this endpoint is for API submission only
        res.status(200).json({ 
            message: 'This endpoint is for API data submission only. Data retrieval is handled by the API server.', 
            apiEndpoint: config.api.url 
        });
    } catch (error) {
        console.error('Error with temperature data endpoint:', error.message);
        res.status(500).json({ error: 'An error occurred with this endpoint' });
    }
});

// Get alert events
router.get('/alerts', async (req, res) => {
    try {
        // Since we're no longer using MongoDB, we return a message indicating this endpoint is for API submission only
        res.status(200).json({ 
            message: 'This endpoint is for API data submission only. Alert retrieval is handled by the API server.',
            apiEndpoint: config.api.url.replace('/temperature-data', '/alerts')
        });
    } catch (error) {
        console.error('Error with alerts endpoint:', error.message);
        res.status(500).json({ error: 'An error occurred with this endpoint' });
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
        
        // Process the data
        await apiClient.processData(data);
        
        res.json({ 
            success: true, 
            message: 'Temperature data submitted successfully and forwarded to API server',
            apiEndpoint: config.api.url
        });
    } catch (error) {
        console.error('Error submitting temperature data:', error.message);
        res.status(500).json({ error: 'Error processing temperature data' });
    }
});

module.exports = router;
