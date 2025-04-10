/*
 * MIT License
 * Copyright (c) 2019, 2018 - present OMRON Corporation
 * All rights reserved.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a
 * copy of this software and associated documentation files (the "Software"),
 * to deal in the Software without restriction, including without limitation
 * the rights to use, copy, modify, merge, publish, distribute, sublicense,
 * and/or sell copies of the Software, and to permit persons to whom the
 * Software is furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
 * DEALINGS IN THE SOFTWARE.
 */

/* includes */
#include <stdio.h>
#include <stdint.h>
#include <fcntl.h>
#include <unistd.h>
#include <string.h>
#include <errno.h>
#include <sys/ioctl.h>
#include <linux/i2c-dev.h>
#include <stdbool.h>
#include <time.h>
#include <linux/i2c.h> //add
#include <sys/stat.h> // For mkfifo
#include <sys/time.h> // For millisecond timestamps
#include <stdlib.h> // For exit()

/* defines */
#define D6T_ADDR 0x0A  // for I2C 7bit address
#define D6T_CMD 0x4C  // for D6T-44L-06/06H, D6T-8L-09/09H, for D6T-1A-01/02
#define N_ROW 4
#define N_PIXEL (4 * 4)
#define N_READ ((N_PIXEL + 1) * 2 + 1)
#define RASPBERRY_PI_I2C "/dev/i2c-0"
#define I2CDEV RASPBERRY_PI_I2C
#define PIPE_NAME "/tmp/sensor_data_pipe"
#define LOG_FILE "/opt2/sees/aibc_demo/logs/SensorDataApp" // Log file location

uint8_t rbuf[N_READ];
double ptat;
double pix_data[N_PIXEL];

void delay(int msec) {
    struct timespec ts = {.tv_sec = msec / 1000,
                          .tv_nsec = (msec % 1000) * 1000000};
    nanosleep(&ts, NULL);
}

/* I2C functions */
/** <!-- i2c_read_reg8 {{{1 --> I2C read function for bytes transfer.
 */

uint32_t i2c_read_reg8(uint8_t devAddr, uint8_t regAddr,
                       uint8_t *data, int length
) {
    int fd = open(I2CDEV, O_RDWR);

    if (fd < 0) {
        fprintf(stderr, "Failed to open device: %s\n", strerror(errno));
        return 21;
    }
    int err = 0;
    do {
        if (ioctl(fd, I2C_SLAVE, devAddr) < 0) {
            fprintf(stderr, "Failed to select device: %s\n", strerror(errno));
            err = 22; break;
        }
        if (write(fd, &regAddr, 1) != 1) {
            err = 23; break;
        }
        delay(1); //add
        int count = read(fd, data, length);
        if (count < 0) {
            err = 24; break;
        } else if (count != length) {
            fprintf(stderr, "Short read  from device, expected %d, got %d\n",
                    length, count);
            err = 25; break;
        }
    } while (false);
    close(fd);
    return err;
}

/* Create directory recursively */
int create_directory(const char *path) {
    char tmp[256];
    char *p = NULL;
    size_t len;
    
    snprintf(tmp, sizeof(tmp), "%s", path);
    len = strlen(tmp);
    
    // Remove trailing slash if present
    if (tmp[len - 1] == '/') {
        tmp[len - 1] = 0;
    }
    
    // Try to create all directories in path
    for (p = tmp + 1; *p; p++) {
        if (*p == '/') {
            *p = 0;
            if (mkdir(tmp, S_IRWXU | S_IRWXG | S_IROTH | S_IXOTH) != 0) {
                if (errno != EEXIST) {
                    return -1;
                }
            }
            *p = '/';
        }
    }
    
    // Create the final directory
    if (mkdir(tmp, S_IRWXU | S_IRWXG | S_IROTH | S_IXOTH) != 0) {
        if (errno != EEXIST) {
            return -1;
        }
    }
    
    return 0;
}

/* Redirection of stdout and stderr to log file */
void redirect_output_to_log() {
    // Extract directory from LOG_FILE path
    char log_dir[128] = {0};
    strncpy(log_dir, LOG_FILE, sizeof(log_dir));
    
    // Find last slash to get directory path
    char *last_slash = strrchr(log_dir, '/');
    if (last_slash) {
        *last_slash = '\0'; // Terminate string at last slash to get directory path only
        // Create the log directory
        if (create_directory(log_dir) != 0) {
            fprintf(stderr, "Failed to create log directory: %s\n", strerror(errno));
            exit(1);
        }
    }
    
    // Generate log filename with date
    time_t current_time = time(NULL);
    struct tm *time_info = localtime(&current_time);
    char log_file_path[256];
    snprintf(log_file_path, sizeof(log_file_path), "%s_%04d%02d%02d.log", 
             LOG_FILE, time_info->tm_year + 1900, time_info->tm_mon + 1, time_info->tm_mday);
    
    FILE *logFile = fopen(log_file_path, "a"); // Open log file in append mode
    if (logFile == NULL) {
        perror("Error opening log file");
        exit(1);
    }
    
    // Print a header to the log file
    fprintf(logFile, "\n\n==== Sensor Log Started at %04d-%02d-%02d %02d:%02d:%02d ====\n\n", 
            time_info->tm_year + 1900, time_info->tm_mon + 1, time_info->tm_mday, 
            time_info->tm_hour, time_info->tm_min, time_info->tm_sec);
    
    // Redirect stdout and stderr to the log file
    dup2(fileno(logFile), STDOUT_FILENO);
    dup2(fileno(logFile), STDERR_FILENO);
    
    // Close the original file descriptor as it's no longer needed
    fclose(logFile);
}

uint8_t calc_crc(uint8_t data) {
    int index;
    uint8_t temp;
    for (index = 0; index < 8; index++) {
        temp = data;
        data <<= 1;
        if (temp & 0x80) {data ^= 0x07;}
    }
    return data;
}

bool D6T_checkPEC(uint8_t buf[], int n) {
    int i;
    uint8_t crc = calc_crc((D6T_ADDR << 1) | 1); // I2C Read address (8bit)
    for (i = 0; i < n; i++) {
        crc = calc_crc(buf[i] ^ crc);
    }
    bool ret = crc != buf[n];
    if (ret) {
        fprintf(stderr, "PEC check failed: %02X(cal)-%02X(get)\n", crc, buf[n]);
    }
    return ret;
}

int16_t conv8us_s16_le(uint8_t* buf, int n) {
    uint16_t ret;
    ret = (uint16_t)buf[n];
    ret += ((uint16_t)buf[n + 1]) << 8;
    return (int16_t)ret;
}

void initialSetting(void) {
}

/* Main - Thermal sensor */
int main() {
    int i;
    int16_t itemp;

    // Redirect stdout and stderr to log file
    redirect_output_to_log();

    // Create named pipe if it doesn't exist
    if (access(PIPE_NAME, F_OK) == -1) {
        printf("Creating named pipe at %s\n", PIPE_NAME);
        if (mkfifo(PIPE_NAME, 0666) == -1) {
            perror("Error creating named pipe");
            return 1;
        }
    }

    delay(620);

    while(1){
        // Read data via I2C
        memset(rbuf, 0, N_READ);
        uint32_t ret = i2c_read_reg8(D6T_ADDR, D6T_CMD, rbuf, N_READ);
        D6T_checkPEC(rbuf, N_READ - 1);

        // Convert to temperature data (degC)
        ptat = (double)conv8us_s16_le(rbuf, 0) / 10.0;
        for (i = 0; i < N_PIXEL; i++) {
            itemp = conv8us_s16_le(rbuf, 2 + 2*i);
            pix_data[i] = (double)itemp / 10.0;
        }

        // Get current date and time with milliseconds
        struct timeval tv;
        gettimeofday(&tv, NULL);
        
        time_t t = tv.tv_sec;
        struct tm tm = *localtime(&t);
        
        // Format date/time strings
        char date_str[20];
        char time_str[20];
        sprintf(date_str, "%04d-%02d-%02d", tm.tm_year + 1900, tm.tm_mon + 1, tm.tm_mday);
        
        long raw_msec = tv.tv_usec / 1000;  // Convert microseconds to milliseconds

        if (raw_msec >= 300) {  // Skip if milliseconds are less than 300
            sprintf(time_str, "%02d:%02d:%02d:%03ld", tm.tm_hour, tm.tm_min, tm.tm_sec, raw_msec);
            printf("%s\n", time_str); // Print only if milliseconds are 300 or more
        }

        // Format output string for console and pipe
        char buffer[1024];
        sprintf(buffer, "id: sensor_1, date: %s, time: %s, PTAT: %4.1f [degC], Temperature: ", 
                date_str, time_str, ptat);
        
        int buffer_len = strlen(buffer);
        char *ptr = buffer + buffer_len;
        
        // Add temperature values
        for (i = 0; i < N_PIXEL; i++) {
            sprintf(ptr, "%4.1f%s", pix_data[i], 
                    (i < N_PIXEL - 1) ? ", " : " [degC]\n");
            ptr = buffer + strlen(buffer);
        }
        
        // Output to console
        printf("%s", buffer);
        
        // Write to named pipe
        int pipe_fd = open(PIPE_NAME, O_WRONLY | O_NONBLOCK);
        if (pipe_fd != -1) {
            write(pipe_fd, buffer, strlen(buffer));
            close(pipe_fd);
            printf("Data sent to pipe\n");
        } else {
            printf("No reader on pipe, skipping write\n");
        }

        delay(300);
    }
}