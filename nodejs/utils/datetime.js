/**
 * Date and time utility functions
 */

/**
 * Get current date and time formatted
 * @returns {Object} - Formatted date and time
 */
function getCurrentDateTime() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    const milliseconds = String(now.getMilliseconds()).padStart(3, '0');
    
    return {
        date: `${year}/${month}/${day}`,
        time: `${hours}:${minutes}:${seconds}.${milliseconds}`,
        created_at: `${year}/${month}/${day} ${hours}:${minutes}:${seconds}.${milliseconds}`,
        timestamp: now.toISOString()
    };
}

module.exports = {
    getCurrentDateTime
};
