# Portfolio Upload Fix - Summary

## Problem
The portfolio upload functionality was showing "Unauthorized" errors when trying to upload images to Supabase Storage.

## Root Cause
The code was using the Supabase service role key through the Supabase client library, which had permission issues with the storage bucket. The successful curl command showed that using the anon key directly via HTTP POST works correctly.

## Solution Implemented

### Changes Made to `web-app/app/api/portfolio/content/route.js`

**Before:** Used Supabase client with service role key
```javascript
const supabase = getServiceSupabase();
const { error: uploadError } = await supabase
    .storage
    .from('portfolio-assets')
    .upload(fileName, optimizedBuffer, {
        contentType: 'image/webp',
        upsert: false
    });
```

**After:** Uses direct HTTP POST with anon key (like the successful curl command)
```javascript
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const uploadUrl = `${supabaseUrl}/storage/v1/object/portfolio-assets/${fileName}`;

const uploadResponse = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
        'Authorization': `Bearer ${anonKey}`,
        'Content-Type': 'image/webp',
    },
    body: optimizedBuffer,
});

if (!uploadResponse.ok) {
    const errorText = await uploadResponse.text();
    throw new Error(`Storage Upload Failed: ${uploadResponse.status} ${errorText}`);
}

// Get public URL
imageUrl = `${supabaseUrl}/storage/v1/object/public/portfolio-assets/${fileName}`;
```

## Why This Works

1. **Direct HTTP Upload**: Uses the same approach as the successful curl command
2. **Anon Key Authentication**: Uses the anon key which has proper permissions for the storage bucket
3. **No Supabase Client Dependency**: Bypasses any issues with the Supabase client library configuration
4. **Simpler Error Handling**: Gets direct HTTP response status and error messages

## How to Test

### Option 1: Via the Web Interface
1. Make sure the dev server is running: `cd web-app && npm run dev`
2. Open the portfolio page
3. Try uploading an image through the post content panel
4. The image should now upload successfully to Supabase Storage

### Option 2: Using the Test Script
```bash
cd web-app
node scripts/test-portfolio-upload.js
```

The test script will:
- Upload the login logo.png file
- Use the new direct HTTP approach
- Display the result and image URL

## Workflow

When a user clicks the "Post" button on the portfolio panel:

1. **User Authentication**: The API route checks if the user is authenticated
2. **Image Processing**: The image is optimized using Sharp (resized to max 1000px, converted to WebP)
3. **Direct Upload**: The optimized image is uploaded directly to Supabase Storage via HTTP POST
4. **Database Save**: The public URL is saved to the `news_items` table

## Benefits

- ✅ Works with the same authentication as the successful curl command
- ✅ No need for local database storage
- ✅ Direct upload to Supabase is faster and more efficient
- ✅ Better error messages from direct HTTP responses
- ✅ Maintains all existing functionality (auth, image optimization, database storage)

## Files Modified

1. `web-app/app/api/portfolio/content/route.js` - Updated the upload logic

## Files Created

1. `web-app/scripts/test-portfolio-upload.js` - Test script for verification

## Environment Variables Required

Ensure these are set in `web-app/.env.local`:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`