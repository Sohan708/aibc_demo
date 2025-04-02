/**
 * D6T Temperature Sensor Data Forwarder
 * Main application file
 */
const express = require('express');
const config = require('./config');
const pipeReader = require('./pipeReader');
const routes = require('./routes');
const apiClient = require('./apiClient');

// Create Express application
const app = express();
app.use(express.json());

// Register routes
app.use('/', routes);

// Start Express server
app.listen(config.port, () => {
    console.log(`Server running on port ${config.port}`);
    console.log(`MongoDB URI: ${config.mongodb.uri}`);
    console.log(`Temperature Alert Thresholds: ${config.temperature.minNormal}°C - ${config.temperature.maxNormal}°C`);
    console.log('Setting up pipe reader...');
    pipeReader.setupPipeReader();
});

// Handle process termination
process.on('SIGINT', () => {
    console.log('Shutting down...');
    pipeReader.closePipeReader();
    process.exit(0);
});
