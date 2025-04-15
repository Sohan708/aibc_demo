#ifndef LOGGER_H
#define LOGGER_H

#include <stdio.h>
#include <time.h>
#include <string.h>
#include <stdarg.h>
#include <sys/stat.h>
#include <sys/types.h>
#include <errno.h>
#include <stdlib.h>
#include <unistd.h>
#include <libgen.h>

// Log levels
typedef enum {
    LOG_DEBUG,
    LOG_INFO,
    LOG_WARN,
    LOG_ERROR,
    LOG_FATAL
} LogLevel;

// Initialize the logger with the base directory
int logger_init(const char *logDir, const char *fileName);

// Log a message with the specified level
void logger_log(LogLevel level, const char *format, ...);

// Close the logger
void logger_close();

// Custom perror replacement
void logger_perror(const char *s);

#endif // LOGGER_H
