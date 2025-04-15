#include "logger.h"

static FILE *logFile = NULL;
static LogLevel currentLogLevel = LOG_INFO;
static char logFilePath[512] = {0};

// Helper function to create directory recursively
static int mkpath(const char *path, mode_t mode) {
    char tmp[512];
    char *p = NULL;
    size_t len;
    
    snprintf(tmp, sizeof(tmp), "%s", path);
    len = strlen(tmp);
    
    // Remove trailing slash
    if (tmp[len - 1] == '/') {
        tmp[len - 1] = 0;
    }
    
    // Walk through path and create directories
    for (p = tmp + 1; *p; p++) {
        if (*p == '/') {
            *p = 0;
            if (mkdir(tmp, mode) != 0) {
                if (errno != EEXIST) {
                    return -1;
                }
            }
            *p = '/';
        }
    }
    
    // Create the final directory
    if (mkdir(tmp, mode) != 0) {
        if (errno != EEXIST) {
            return -1;
        }
    }
    
    return 0;
}

// Returns the current date/time as a string
static void get_time_string(char *buffer, size_t size, int include_date) {
    time_t now = time(NULL);
    struct tm *tm_info = localtime(&now);
    
    if (include_date) {
        strftime(buffer, size, "%Y-%m-%d %H:%M:%S", tm_info);
    } else {
        strftime(buffer, size, "%H:%M:%S", tm_info);
    }
}

// Initialize the logger
int logger_init(const char *logDir, const char *fileName) {
    char dateStr[20];
    time_t now = time(NULL);
    struct tm *tm_info = localtime(&now);
    
    strftime(dateStr, sizeof(dateStr), "%Y%m%d", tm_info);
    
    // Create directories if they don't exist
    if (mkpath(logDir, 0755) != 0) {
        fprintf(stderr, "Failed to create log directory: %s\n", strerror(errno));
        return -1;
    }
    
    // Construct log file path
    snprintf(logFilePath, sizeof(logFilePath), "%s/%s_%s.log", 
             logDir, fileName, dateStr);
    
    // Open log file
    logFile = fopen(logFilePath, "a");
    if (!logFile) {
        fprintf(stderr, "Failed to open log file %s: %s\n", 
                logFilePath, strerror(errno));
        return -1;
    }
    
    // Log initialization
    char timeStr[25];
    get_time_string(timeStr, sizeof(timeStr), 1);
    fprintf(logFile, "[%s] [INFO] Logging initialized\n", timeStr);
    fflush(logFile);
    
    return 0;
}

// Get string representation of log level
static const char* get_level_string(LogLevel level) {
    switch (level) {
        case LOG_DEBUG: return "DEBUG";
        case LOG_INFO:  return "INFO";
        case LOG_WARN:  return "WARN";
        case LOG_ERROR: return "ERROR";
        case LOG_FATAL: return "FATAL";
        default:        return "UNKNOWN";
    }
}

// Log a message
void logger_log(LogLevel level, const char *format, ...) {
    if (!logFile) return;
    if (level < currentLogLevel) return;
    
    va_list args;
    char timeStr[25];
    
    get_time_string(timeStr, sizeof(timeStr), 0);
    fprintf(logFile, "[%s] [%s] ", timeStr, get_level_string(level));
    
    va_start(args, format);
    vfprintf(logFile, format, args);
    va_end(args);
    
    if (format[strlen(format) - 1] != '\n') {
        fprintf(logFile, "\n");
    }
    
    fflush(logFile);
    
    // Also print to console for ERROR and FATAL
    if (level >= LOG_ERROR) {
        fprintf(stderr, "[%s] [%s] ", timeStr, get_level_string(level));
        va_start(args, format);
        vfprintf(stderr, format, args);
        va_end(args);
        
        if (format[strlen(format) - 1] != '\n') {
            fprintf(stderr, "\n");
        }
    }
}

// Custom perror replacement that logs to file
void logger_perror(const char *s) {
    logger_log(LOG_ERROR, "%s: %s", s, strerror(errno));
    
    // Also print to stderr
    fprintf(stderr, "%s: %s\n", s, strerror(errno));
}

// Close the logger
void logger_close() {
    if (logFile) {
        char timeStr[25];
        get_time_string(timeStr, sizeof(timeStr), 1);
        fprintf(logFile, "[%s] [INFO] Logging terminated\n", timeStr);
        fclose(logFile);
        logFile = NULL;
    }
}
