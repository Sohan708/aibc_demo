/**
 * Alert controller for handling alert data
 */
const axios = require('axios');
const { getLogger } = require('../utils/logger');

const logger = getLogger('alert');

/**
 * Initialize the alert controller
 * @param {Object} config - Configuration object
 * @returns {Object} Controller methods
 */
function initAlertController(config) {
    const alertsApiUrl = `http://${config.server.ip}:${config.server.port}${config.server.endpoints.alerts}`;
    
    logger.info(`Alert controller initialized`);
    logger.info(`Alert API endpoint: ${alertsApiUrl}`);
    
    // Track alert state for each sensor to detect changes
    const sensorAlertState = {};
    
    /**
     * Send alert data to API
     * @param {Object} data - Alert data to send
     */
    async function sendAlertData(data) {
        try {
            logger.debug(`Sending alert data for sensor ${data.sensor_id}`);
            const response = await axios.post(alertsApiUrl, data);
            logger.info(`Alert data sent successfully: ${response.status} ${response.statusText}`);
            return true;
        } catch (error) {
            if (error.response) {
                logger.error(`Failed to send alert data: ${error.response.status} ${error.response.statusText}`);
            } else {
                logger.error(`Error sending alert data: ${error.message}`);
            }
            return false;
        }
    }
    
    /**
     * Check for alert state transitions and send alerts if needed
     * @param {String} sensorId - Sensor ID
     * @param {Boolean} isAbnormal - Current abnormal state
     * @param {Object} sensorData - Sensor data
     * @param {Object} analysis - Temperature analysis results
     * @returns {Boolean} Whether an alert was sent
     */
    async function checkAndHandleAlertTransition(sensorId, isAbnormal, sensorData, analysis) {
        try {
            // Get previous state or default to false (normal)
            const previousState = sensorAlertState[sensorId] || false;
            
            // If state hasn't changed, no need to send an alert
            if (previousState === isAbnormal) {
                return false;
            }
            
            // Create alert document
            const alertRecord = {
                sensor_id: sensorId,
                date: sensorData.date,
                time: sensorData.time,
                alert_reason: isAbnormal ? analysis.alertReason : '温度が正常範囲に戻りました',
                status: isAbnormal ? '１：異常' : '0 ：正常'
            };
            
            // Send alert to API
            await sendAlertData(alertRecord);
            
            // Log the alert or recovery
            if (isAbnormal) {
                logger.warn(`⚠️ ALERT: ${alertRecord.alert_reason} for sensor ${alertRecord.sensor_id}`);
            } else {
                logger.info(`✅ RECOVERY: Temperature returned to normal for sensor ${alertRecord.sensor_id}`);
            }
            
            // Update the sensor state
            sensorAlertState[sensorId] = isAbnormal;
            
            return true;
        } catch (error) {
            logger.error(`Error handling alert transition: ${error.message}`, error);
            return false;
        }
    }
    
    /**
     * Get a copy of the current sensor alert states
     * @returns {Object} Current sensor alert states
     */
    function getSensorAlertStates() {
        return {...sensorAlertState};
    }
    
    return {
        sendAlertData,
        checkAndHandleAlertTransition,
        getSensorAlertStates
    };
}

module.exports = initAlertController;
