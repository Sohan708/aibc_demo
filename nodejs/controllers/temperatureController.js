/**
 * Temperature controller for processing and sending temperature data
 */
const axios = require('axios');
const { getLogger } = require('../utils/logger');

const logger = getLogger('temperature');

/**
 * Initialize the temperature controller
 * @param {Object} config - Configuration object
 * @returns {Object} Controller methods
 */
function initTemperatureController(config) {
    const temperatureApiUrl = `http://${config.server.ip}:${config.server.port}${config.server.endpoints.temperature}`;
    const minNormalTemp = config.threshold.min;
    const maxNormalTemp = config.threshold.max;
    
    logger.info(`Temperature controller initialized with threshold: min=${minNormalTemp}°C, max=${maxNormalTemp}°C`);
    logger.info(`Temperature API endpoint: ${temperatureApiUrl}`);
    
    /**
     * Analyze temperature data for anomalies
     * @param {Array} temperatureData - Array of temperature readings
     * @returns {Object} - Analysis result
     */
    function analyzeTemperatureData(temperatureData) {
        try {
            const maxTemp = Math.max(...temperatureData);
            const minTemp = Math.min(...temperatureData);
            const avgTemp = temperatureData.reduce((sum, temp) => sum + temp, 0) / temperatureData.length;
            
            let isAbnormal = false;
            let alertReason = '';
            
            // Check for temperature out of normal range
            if (maxTemp > maxNormalTemp) {
                isAbnormal = true;
                alertReason = `温度が ${maxNormalTemp}°C超えました`;
                logger.warn(`Abnormal temperature detected: ${maxTemp}°C exceeds maximum threshold of ${maxNormalTemp}°C`);
            } else if (minTemp < minNormalTemp) {
                isAbnormal = true;
                alertReason = `温度が ${minNormalTemp}°C未満になりました`;
                logger.warn(`Abnormal temperature detected: ${minTemp}°C below minimum threshold of ${minNormalTemp}°C`);
            } else {
                logger.debug(`Temperature within normal range: min=${minTemp}°C, max=${maxTemp}°C, avg=${avgTemp.toFixed(2)}°C`);
            }
            
            return {
                isAbnormal,
                alertReason,
                avgTemp,
                maxTemp,
                minTemp
            };
        } catch (error) {
            logger.error(`Error analyzing temperature data: ${error.message}`, error);
            // Return default values in case of error
            return {
                isAbnormal: false,
                alertReason: '',
                avgTemp: 0,
                maxTemp: 0,
                minTemp: 0
            };
        }
    }
    
    /**
     * Send temperature data to API
     * @param {Object} data - Temperature data to send
     */
    async function sendTemperatureData(data) {
        try {
            logger.debug(`Sending temperature data for sensor ${data.sensor_id}`);
            const response = await axios.post(temperatureApiUrl, data);
            logger.info(`Temperature data sent successfully: ${response.status} ${response.statusText}`);
            return true;
        } catch (error) {
            if (error.response) {
                logger.error(`Failed to send temperature data: ${error.response.status} ${error.response.statusText}`);
            } else {
                logger.error(`Error sending temperature data: ${error.message}`);
            }
            return false;
        }
    }
    
    /**
     * Create temperature record from sensor data
     * @param {Object} sensorData - Parsed sensor data
     * @param {Object} analysis - Analysis results
     * @returns {Object} Temperature record
     */
    function createTemperatureRecord(sensorData, analysis) {
        return {
            sensor_id: sensorData.sensorId,
            date: sensorData.date,
            time: sensorData.time,
            temperature_data: sensorData.temperatureData,
            average_temp: analysis.avgTemp,
            status: analysis.isAbnormal ? '１：異常' : '0 ：正常'
        };
    }
    
    return {
        analyzeTemperatureData,
        sendTemperatureData,
        createTemperatureRecord
    };
}

module.exports = initTemperatureController;
