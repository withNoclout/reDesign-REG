/**
 * Input sanitization utilities for API routes.
 * Lightweight — no external dependencies required.
 */

/**
 * Escape HTML special characters to prevent XSS.
 * @param {string} str
 * @returns {string}
 */
export function escapeHtml(str) {
    if (typeof str !== 'string') return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;');
}

/**
 * Strip HTML tags from a string.
 * @param {string} str
 * @returns {string}
 */
export function stripHtml(str) {
    if (typeof str !== 'string') return '';
    return str.replace(/<[^>]*>/g, '');
}

/**
 * Sanitize a search query: trim, limit length, strip dangerous characters.
 * @param {string} query
 * @param {Object} options
 * @param {number} options.minLength - Minimum allowed length (default: 1)
 * @param {number} options.maxLength - Maximum allowed length (default: 100)
 * @returns {{ valid: boolean, sanitized: string, error?: string }}
 */
export function sanitizeSearchQuery(query, { minLength = 1, maxLength = 100 } = {}) {
    if (typeof query !== 'string') {
        return { valid: false, sanitized: '', error: 'Query must be a string' };
    }

    const trimmed = query.trim();

    if (trimmed.length < minLength) {
        return { valid: false, sanitized: '', error: `Query must be at least ${minLength} characters` };
    }

    if (trimmed.length > maxLength) {
        return { valid: false, sanitized: '', error: `Query must be at most ${maxLength} characters` };
    }

    // Remove null bytes and control characters, keep Unicode (Thai, etc.)
    const sanitized = trimmed
        .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
        .replace(/[<>"'\\;]/g, '');

    if (sanitized.length < minLength) {
        return { valid: false, sanitized: '', error: 'Query contains only invalid characters' };
    }

    return { valid: true, sanitized };
}

/**
 * Validate that a value matches expected student code format.
 * @param {string} code - Student code (e.g., "6701091611290")
 * @returns {boolean}
 */
export function isValidStudentCode(code) {
    if (typeof code !== 'string') return false;
    // Accept: pure digits (6-15 chars) or 's' prefix + digits
    return /^s?\d{6,15}$/i.test(code);
}

/**
 * Sanitize an array of student codes.
 * @param {any} codes
 * @param {Object} options
 * @param {number} options.maxItems - Maximum allowed items (default: 20)
 * @returns {{ valid: boolean, sanitized: string[], error?: string }}
 */
export function sanitizeStudentCodes(codes, { maxItems = 100 } = {}) {
    if (!Array.isArray(codes)) {
        return { valid: false, sanitized: [], error: 'Collaborators must be an array' };
    }

    if (codes.length > maxItems) {
        return { valid: false, sanitized: [], error: `Maximum ${maxItems} collaborators allowed` };
    }

    const unique = [...new Set(codes)];
    const invalid = unique.filter(c => !isValidStudentCode(c));

    if (invalid.length > 0) {
        return { valid: false, sanitized: [], error: `Invalid student codes: ${invalid.join(', ')}` };
    }

    return { valid: true, sanitized: unique };
}
