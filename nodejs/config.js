/**
 * Configuration for the Sensor Data Forwarder application
 */
module.exports = {
    pipe: '/tmp/sensor_data_pipe',
    port: 3000,
    api: {
        url: 'http://192.168.5.117:3000/temperature-data',  // Windows IP Address
        retryLimit: 5,
        retryDelay: 3000  // 3 seconds
    },
    mongodb: {
        uri: 'mongodb+srv://AIBC:2324@clustertest.fsaqy.mongodb.net/?retryWrites=true&w=majority&appName=ClusterTest',
        dbName: 'sensorData',
        temperatureCollection: 'temperature_readings',
        alertsCollection: 'alerts_log'
    },
    temperature: {
        minNormal: 20.0,  // Minimum normal temperature (Celsius)
        maxNormal: 70.0   // Maximum normal temperature (Celsius)
    }
};
