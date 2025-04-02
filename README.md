# D6T-44L-06 Temperature Sensor Data System

This system collects temperature data from D6T-44L-06 thermal sensors and forwards it to an external API. The system consists of two main components:

1. **C Program (Sensor Data Collector)**: Reads data from the thermal sensors and writes it to a named pipe.
2. **Node.js Application (Data Forwarder)**: Reads data from the named pipe and forwards it to an external API.

## System Requirements

- Yocto Linux system
- I2C interface (bus 0)
- Root privileges for I2C access
- json-c library for the C program
- Node.js and npm for the data forwarder

## Hardware Requirements

- D6T-44L-06 thermal sensor(s) connected via I2C (bus 0)
- The sensor reads 16 pixels (4x4) of thermal data

## Installation

### C Program

1. Navigate to the `c_programming` directory:
   ```
   cd c_programming
   ```

2. Compile the C program:
   ```
   gcc -o sensor_collector sensor.c -ljson-c
   ```

### Node.js Application

1. Navigate to the `nodejs` directory:
   ```
   cd nodejs
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Configure the API endpoint:
   You can set the API endpoint through the environment variable `API_URL` or update the default value in `server.js`.

## Usage

### Starting the C Program

Run the sensor data collector with root privileges:

```
sudo ./c_programming/sensor_collector
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

## Data Flow

1. The C program reads temperature data from the D6T-44L-06 sensors via I2C bus 0.
2. The data is formatted as JSON and written to the named pipe at `/tmp/sensor_data_pipe`.
3. The Node.js application reads from the pipe and forwards the data to the configured API endpoint.
4. If the API is unreachable, the data is buffered and retried later.

## API Format

The data sent to the API is in the following JSON format:

```json
{
  "sensor_id": "sensor_1",
  "date": "2025-03-26 11:41:31",
  "temperature": [22.5, 23.1, 22.8, 23.0, 22.7, 23.2, 22.9, 23.3, 22.6, 23.0, 22.8, 23.1, 22.7, 23.2, 22.9, 23.0]
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
