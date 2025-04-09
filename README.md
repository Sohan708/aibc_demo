# AIBC Demo - Temperature Sensor Data System

This system collects temperature data from D6T-44L-06 thermal sensors and forwards it to an external API server. The system consists of two main components:

1. **C Program (Sensor Data Collector)**: Reads data from the thermal sensors and writes to a named pipe.
2. **Node.js Application (Data Processor)**: Reads data from the named pipe, processes it, and sends it to an API server.

## Project Structure

```
aibc_demo/
├── config/                # Configuration files
│   ├── config.json       # Application configuration 
│   └── log4js.json       # Logging configuration
├── d6t/                  # C program for sensor data collection
│   ├── bin/              # Compiled executable files
│   ├── obj/              # Object files 
│   └── src/              # Source code and Makefile
│       ├── Makefile
│       └── sensor.c      # Reads from sensor and writes to named pipe
├── logs/                 # Log files directory
│   ├── pipeReader.log    # Application logs
│   └── error.log         # Error logs
├── nodejs/               # Node.js application
│   ├── controllers/      # Business logic modules
│   │   ├── alertController.js     # Handles alert data
│   │   └── temperatureController.js # Processes temperature data
│   ├── middlewares/      # Express middlewares (reserved for future use)
│   ├── utils/            # Utility modules
│   │   ├── config.js     # Configuration loader
│   │   ├── datetime.js   # Date/time utilities
│   │   └── logger.js     # Logging utility using log4js
│   ├── server.js         # Main application entry point
│   └── pipeReader.js     # Pipe reader module
├── pipeReader.service    # Systemd service file for the Node.js application
├── SensorDataApp.service # Systemd service file for the C application
└── README.md             # This documentation file
```

## System Requirements

- Linux system (for production)
- Windows/Linux (for development)
- On Linux: I2C interface and root privileges for I2C access
- Node.js and npm

## Hardware Requirements

- D6T-44L-06 thermal sensor(s) connected via I2C
- The sensor reads 16 pixels (4x4) of thermal data

## Configuration

All configuration is centralized in the `config/` directory:

### Application Configuration (config.json)

```json
{
  "pipe": {
    "name": "/tmp/sensor_data_pipe"
  },
  "threshold": {
    "min": 10.0,
    "max": 70.0
  },
  "server": {
    "ip": "192.168.5.107",
    "port": 3000,
    "endpoints": {
      "temperature": "/api/data",
      "alerts": "/api/alerts"
    }
  }
}
```

### Logging Configuration (log4js.json)

The application uses log4js for comprehensive logging to both console and files.

## Installation

### C Program

1. Navigate to the `d6t/src` directory:
   ```
   cd d6t/src
   ```

2. Compile the C program using make:
   ```
   make
   ```
   This will create the executable in `d6t/bin/SensorDataApp`

### Node.js Application

1. Navigate to the `nodejs` directory:
   ```
   cd nodejs
   ```

2. Install dependencies:
   ```
   npm install
   ```

## Usage

### Starting the C Program

Run the sensor data collector with root privileges:

```
sudo ./d6t/bin/SensorDataApp
```

### Starting the Node.js Application

Start the data processor:

```
cd nodejs
node server.js
```

### Setting up as Services

Systemd service files are provided for both components:

1. Copy the service files to the systemd directory:
   ```
   sudo cp SensorDataApp.service pipeReader.service /etc/systemd/system/
   ```

2. Enable and start the services:
   ```
   sudo systemctl enable SensorDataApp.service pipeReader.service
   sudo systemctl start SensorDataApp.service pipeReader.service
   ```

## Data Flow

1. The C program reads temperature data from the D6T-44L-06 sensors via I2C.
2. The data is formatted and written to the named pipe at `/tmp/sensor_data_pipe`.
3. The Node.js pipe reader continuously reads from the pipe in real-time.
4. Temperature data is processed, analyzed for anomalies, and sent to the API.
5. If temperature anomalies are detected, alerts are generated and sent to the API.
6. The system automatically reconnects if the pipe or API becomes unavailable.

## API Data Format

The system sends two types of data to the API server:

### Temperature Data
```json
{
  "sensor_id": "sensor_1",
  "date": "2025-04-08",
  "time": "14:25:23:171",
  "temperature_data": [25.4, 26.1, 24.8, 25.3, 25.0, 25.2, 24.9, 25.5, 25.6, 25.7, 25.8, 25.9, 26.0, 26.1, 26.2, 26.3],
  "average_temp": 25.74,
  "status": "0 ：正常"
}
```

### Alert Data (when temperature anomalies are detected)
```json
{
  "sensor_id": "sensor_1",
  "date": "2025-04-08",
  "time": "14:25:23:171",
  "alert_reason": "温度が 70.0°C超えました",
  "status": "0 ：正常"
}
```

## Logging

The application uses log4js for comprehensive logging:

- Console logging for development and debugging
- File logging for production monitoring and troubleshooting
- Separate log files for different components (pipe reader, temperature processing, alerts)
- Error logs are stored in a dedicated file

Logs are stored in the `logs/` directory and include timestamps and log levels.

## Error Handling

The application includes robust error handling:

- Automatic pipe reconnection if the connection is lost
- Graceful handling of API connection failures with retry logic
- Uncaught exception handling to prevent application crashes
- Detailed error logging for troubleshooting

## Troubleshooting

- Ensure you have the necessary permissions to access the I2C bus on Linux systems
- Check the logs in the `logs/` directory for error messages
- Verify that the named pipe exists at the specified location
- Check that the API server is running and accessible
- Ensure the correct IP address is configured in `config/config.json`
- If needed, restart both services to re-establish connections
