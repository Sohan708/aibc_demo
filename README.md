# AIBC Demo - Temperature Sensor Data System

This system collects temperature data from D6T-44L-06 thermal sensors and forwards it to an external API server. The system consists of two main components:

1. **C Program (Sensor Data Collector)**: Reads data from the thermal sensors and writes it to a file that acts as a data pipe.
2. **Node.js Application (Data Forwarder)**: Reads data from the file in real-time and forwards it to an API server.

## Project Structure

```
aibc_demo/
├── d6t/                   # C program for sensor data collection
│   ├── bin/               # Compiled executable files
│   ├── obj/               # Object files 
│   └── src/               # Source code and Makefile
│       ├── Makefile
│       └── sensor.c       # Reads from sensor and writes to data pipe
├── nodejs/                # Node.js API client for data forwarding
│   ├── apiClient.js       # Client for sending data to API (deprecated)
│   ├── package.json       # Node.js dependencies
│   └── pipeReader.js      # Pipe reader that handles all data processing
└── README.md             # This documentation file
```

## System Requirements

- Windows or Linux system
- On Linux: I2C interface (bus 0) and root privileges for I2C access
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

3. Configuration:
   API endpoints and other configuration options are now directly integrated into `pipeReader.js`.

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
node pipeReader.js
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
2. The data is formatted and written to the file at `/tmp/sensor_data_pipe` (Linux) or a specified file path on Windows.
3. The Node.js application continuously reads from the file in real-time and forwards the data to the configured API endpoint at `http://192.168.5.104:3000/api/data`.
4. The system will automatically reconnect if the pipe or API becomes unavailable.

## API Data Format

The system sends two types of data to the API server:

### Temperature Data
```json
{
  "sensor_id": "sensor_1",
  "date": "2025-04-03",
  "time": "14:25:23:171",
  "temperature_data": [25.4, 26.1, 24.8, 25.3, 25.0, 25.2, 24.9, 25.5, 25.6, 25.7, 25.8, 25.9, 26.0, 26.1, 26.2, 26.3],
  "average_temp": 25.74,
  "max_temp": 26.3,
  "min_temp": 24.8,
  "ptat": 26.5,
  "status": "normal"
}
```

### Alert Data (when temperature anomalies are detected)
```json
{
  "sensor_id": "sensor_1",
  "date": "2025-04-03",
  "time": "14:25:23:171",
  "alert_reason": "温度が 70.0°C超えました",
  "status": "alert"
}
```

## Monitoring

The application logs all data read from the sensor, any errors encountered, and the status of alerts to the console. 

## Troubleshooting

- Ensure you have the necessary permissions to access the I2C bus (root or i2c group membership) on Linux systems
- Check that the data pipe file exists at the specified location
- Verify that the sensor is properly connected to I2C bus 0 on Linux systems
- Check the logs from both the C program and Node.js application for errors
- Verify the API server at 192.168.5.104:3000 is running and accessible
- If the application stops reading data, check if the pipe file needs to be recreated
