# BASE_DIR Implementation Summary

## Problem Identified

**Error:** `Temp file not found: D:\reDesign-REG\public\temp\1771098504173_soofva.webp`

**Root Cause:** Path resolution inconsistency between different parts of the upload system:
- `content/route.js` saved files to `web-app/public/temp/`
- `upload-temp-to-supabase.js` tried to find files at `reDesign-REG/public/temp/`
- The script was resolving paths incorrectly by going back too many directories

## Solution: BASE_DIR Consistency

Implemented a unified `BASE_DIR` approach across all upload-related files to ensure consistent path resolution.

---

## Files Modified

### 1. web-app/app/api/portfolio/content/route.js
**Changes:**
- Added `BASE_DIR = process.cwd()` constant
- Changed temp file path storage from relative to absolute paths
- Updated temp directory creation to use `BASE_DIR`
- Store absolute path in database: `D:\reDesign-REG\web-app\public\temp\xxx.webp`

**Key Code:**
```javascript
const BASE_DIR = process.cwd(); // = web-app/
tempFilePath = path.join(BASE_DIR, 'public', 'temp', tempFileName);
```

---

### 2. web-app/app/api/portfolio/upload/route.js
**Changes:**
- Added `BASE_DIR = process.cwd()` constant
- Passes absolute temp path to upload script

**Key Code:**
```javascript
const BASE_DIR = process.cwd(); // = web-app/
const args = [itemId, tempPath]; // tempPath is now absolute
```

---

### 3. web-app/scripts/upload-temp-to-supabase.js ⭐ CRITICAL
**Changes:**
- Added `BASE_DIR = path.join(__dirname, '..')` constant
- Implemented intelligent path detection (absolute vs relative)
- Added comprehensive error logging
- Supports both new absolute paths AND old relative paths (backward compatible)

**Key Code:**
```javascript
const BASE_DIR = path.join(__dirname, '..'); // = web-app/

// Detect if path is absolute or relative
let isAbsolute = path.isAbsolute(tempPath.trim());

if (isAbsolute) {
    fullPath = tempPath.trim(); // Use absolute path directly
} else {
    fullPath = path.resolve(BASE_DIR, tempPath.trim()); // Convert relative to absolute
}

fullPath = path.normalize(fullPath);
```

**Why this fixes the error:**
- New uploads use absolute paths from `content/route.js`
- Script detects absolute path and uses it directly
- No more incorrect path resolution
- Backward compatible with existing relative paths

---

### 4. web-app/app/api/portfolio/batch-upload/route.js
**Changes:**
- Added `BASE_DIR = process.cwd()` constant
- Updated file existence check to use `BASE_DIR`

**Key Code:**
```javascript
const BASE_DIR = process.cwd();
const fullPath = path.join(BASE_DIR, item.temp_path);
```

---

### 5. web-app/app/api/portfolio/retry-upload/route.js
**Changes:**
- Added `BASE_DIR = process.cwd()` constant
- Updated file existence check to use `BASE_DIR`

**Key Code:**
```javascript
const BASE_DIR = process.cwd();
const fullPath = path.join(BASE_DIR, item.temp_path);
```

---

### 6. web-app/scripts/recover-failed-uploads.js
**Changes:**
- Added `BASE_DIR = path.join(__dirname, '..')` constant
- Implemented intelligent path detection (absolute vs relative)
- Matches the logic in `upload-temp-to-supabase.js`

**Key Code:**
```javascript
const BASE_DIR = path.join(__dirname, '..');

let isAbsolute = path.isAbsolute(temp_path.trim());
if (isAbsolute) {
    fullPath = temp_path.trim();
} else {
    fullPath = path.resolve(BASE_DIR, temp_path.trim());
}
```

---

## Path Resolution Flow

### Before (BROKEN)
```
content/route.js: Save to D:\reDesign-REG\web-app\public\temp\xxx.webp
Database: Store "public/temp/xxx.webp" (relative)
upload script: Resolve from scripts/ directory
  → path.join(__dirname, '../..', 'public/temp/xxx.webp')
  → D:\reDesign-REG\public\temp\xxx.webp ❌ WRONG!
```

### After (FIXED)
```
content/route.js: Save to D:\reDesign-REG\web-app\public\temp\xxx.webp
Database: Store "D:\reDesign-REG\web-app\public\temp\xxx.webp" (absolute)
upload script: Detect absolute path
  → Use absolute path directly
  → D:\reDesign-REG\web-app\public\temp\xxx.webp ✅ CORRECT!
```

---

## Backward Compatibility

The implementation supports both:
1. **New behavior**: Absolute paths (current uploads)
2. **Old behavior**: Relative paths (legacy uploads in database)

The script automatically detects which type of path is provided and handles it correctly.

---

## Testing Recommendations

### 1. Test New Upload
```bash
# Try uploading a new portfolio item
# Check console logs for:
# - [Portfolio API] BASE_DIR: D:\reDesign-REG\web-app
# - [Portfolio API] Temp file path (absolute): D:\reDesign-REG\web-app\public\temp\xxx.webp
# - [Upload Script] BASE_DIR: D:\reDesign-REG\web-app
# - [Upload Script] Is tempPath absolute? true
# - [Upload Script] Using absolute path directly
# - [Upload Script] File should exist: true
```

### 2. Test Batch Upload
```bash
# Navigate to web-app directory
cd web-app
# Run batch upload from UI or API
# Should upload all failed items correctly
```

### 3. Test Recovery Script
```bash
cd web-app/scripts
node recover-failed-uploads.js
# Should handle both absolute and relative paths correctly
```

---

## Error Prevention

### Logging Improvements
All files now log:
- BASE_DIR value on startup
- Absolute vs relative path detection
- Final resolved path
- File existence check results

### Path Consistency
- All APIs use `process.cwd()` for BASE_DIR
- All scripts use `path.join(__dirname, '..')` for BASE_DIR
- Both resolve to `web-app/` directory

### Cross-Platform Support
- Uses `path.normalize()` for consistency
- Handles both Windows (`\`) and Unix (`/`) path separators
- Absolute paths work across all operating systems

---

## Summary of Changes

| File | BASE_DIR | Path Storage | Key Change |
|------|----------|--------------|-------------|
| content/route.js | `process.cwd()` | Absolute | Store full path |
| upload/route.js | `process.cwd()` | N/A (passes through) | Added constant |
| upload-temp-to-supabase.js | `path.join(__dirname, '..')` | N/A (reads from DB) | Detect absolute/relative |
| batch-upload/route.js | `process.cwd()` | N/A (reads from DB) | Use BASE_DIR |
| retry-upload/route.js | `process.cwd()` | N/A (reads from DB) | Use BASE_DIR |
| recover-failed-uploads.js | `path.join(__dirname, '..')` | N/A (reads from DB) | Detect absolute/relative |

---

## Expected Result

✅ New uploads will succeed without "Temp file not found" error
✅ Existing failed uploads can be recovered using batch upload or recovery script
✅ Consistent path resolution across all upload operations
✅ Better error messages for debugging
✅ Cross-platform compatibility maintained

---

## Next Steps

1. **Test the fix** - Upload a new portfolio item
2. **Verify logs** - Check that paths are resolved correctly
3. **Recover old items** - Use batch upload to retry failed uploads
4. **Monitor** - Watch for any path-related errors in console

---

## Implementation Date

February 15, 2026
Implemented by: Cline AI Assistant