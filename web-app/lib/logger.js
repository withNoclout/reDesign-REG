/**
 * Client-side logger that sends errors to the server API
 * This allows us to persist frontend errors to the server logs
 */
export const logError = async (error, context = 'Client') => {
    // Prevent infinite loops if logging itself fails
    try {
        const errorData = {
            level: 'ERROR',
            message: error.message || String(error),
            stack: error.stack || 'No stack trace',
            context,
            timestamp: new Date().toISOString(),
            url: typeof window !== 'undefined' ? window.location.href : 'Unknown URL'
        };

        // Fire and forget - don't await to avoid blocking UI
        fetch('/api/log', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(errorData)
        }).catch(e => console.error('Failed to send log to server:', e));
        
    } catch (e) {
        // Fallback to console if everything fails
        console.error('Critical logger failure:', e);
    }
};
