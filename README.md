# AIBC Demo - Temperature Sensor Data System

This system collects temperature data from D6T-44L-06 thermal sensors and forwards it to an external API server. The system consists of two main components:

1. **C Program (Sensor Data Collector)**: Reads data from the thermal sensors and writes it to a named pipe.
2. **Node.js Application (Data Forwarder)**: Reads data from the named pipe and forwards it to an API server.

## Project Structure

```
aibc_demo/
├── d6t/                   # C program for sensor data collection
│   ├── bin/               # Compiled executable files
│   ├── obj/               # Object files 
│   └── src/               # Source code and Makefile
│       ├── Makefile
│       └── sensor.c
├── nodejs/                # Node.js API client for data forwarding
│   ├── apiClient.js       # Client for sending data to API
│   ├── config.js          # Configuration settings
│   ├── package.json       # Node.js dependencies
│   ├── pipeReader.js      # Module for reading from named pipe
│   ├── routes.js          # API routes
│   └── server.js          # Main server application
└── aibc_demo.service      # Systemd service file
```

## System Requirements

- Yocto Linux system
- I2C interface (bus 0)
- Root privileges for I2C access
- Node.js and npm for the data forwarder

## Hardware Requirements

- D6T-44L-06 thermal sensor(s) connected via I2C (bus 0)
- The sensor reads 16 pixels (4x4) of thermal data

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

3. Configure the API endpoint in `config.js`:
   The current configuration sends data to `http://192.168.5.117:3000/temperature-data`

## Usage

### Starting the C Program

Run the sensor data collector with root privileges:

```
sudo ./d6t/bin/SensorDataApp
```

### Starting the Node.js Application

Start the data forwarder:

```
cd nodejs
npm start
```

Or using node directly:

```
node nodejs/server.js
```

### Setting up as a Service

A systemd service file is provided (`aibc_demo.service`). To install:

1. Copy the service file to the systemd directory:
   ```
   sudo cp aibc_demo.service /etc/systemd/system/
   ```

2. Enable and start the service:
   ```
   sudo systemctl enable aibc_demo.service
   sudo systemctl start aibc_demo.service
   ```

## Data Flow

1. The C program reads temperature data from the D6T-44L-06 sensors via I2C bus 0.
2. The data is formatted and written to the named pipe at `/tmp/sensor_data_pipe`.
3. The Node.js application reads from the pipe and forwards the data to the configured API endpoint.
4. If the API is unreachable, the data is buffered and retried later.

## API Data Format

The system sends two types of data to the API server:

### Temperature Data
```json
{
  "sensor_id": "D6T-001",
  "date": "2025/04/02",
  "time": "13:18:51.123",
  "temperature_data": [25.4, 26.1, 24.8, 25.3, 25.0, 25.2, 24.9, 25.5],
  "average_temp": 25.15,
  "status": "normal",
  "created_at": "2025/04/02 13:18:51.123"
}
```

### Alert Data (when temperature anomalies are detected)
```json
{
  "sensor_id": "D6T-001",
  "date": "2025/04/02",
  "time": "13:18:51.123",
  "alert_reason": "温度が 70.0°C超えました",
  "status": "alert",
  "created_at": "2025/04/02 13:18:51.123"
}
```

## Monitoring

You can check the status of the data forwarder by accessing the `/status` endpoint:

```
http://localhost:3000/status
```

This provides information about the service status, how many items are in the buffer, and when it was last updated.

## Troubleshooting

- Ensure you have the necessary permissions to access the I2C bus (root or i2c group membership)
- Check that the named pipe exists at `/tmp/sensor_data_pipe`
- Verify that the sensor is properly connected to I2C bus 0
- Check the logs from both the C program and Node.js application for errors
- Verify the API server at 192.168.5.117:3000 is running and accessible
