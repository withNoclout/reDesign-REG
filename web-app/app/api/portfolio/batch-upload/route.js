import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { getAuthUser } from '@/lib/auth';
import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';

// BASE_DIR: Root directory for web-app (consistent across all upload-related files)
const BASE_DIR = process.cwd(); // = web-app/
console.log('[Batch Upload API] BASE_DIR:', BASE_DIR);

export async function POST(request) {
    try {
        // Check authentication
        const userId = await getAuthUser();
        if (!userId) {
            return NextResponse.json(
                { success: false, message: 'Unauthorized' },
                { status: 401 }
            );
        }

        console.log('[Batch Upload API] Starting batch upload for user:', userId);

        const supabase = getServiceSupabase();

        // Step 1: Find all items that haven't been uploaded
        const { data: failedItems, error: fetchError } = await supabase
            .from('news_items')
            .select('*')
            .eq('created_by', String(userId))
            .eq('uploaded_to_supabase', false)
            .is('temp_path', 'not.null')
            .order('created_at', { ascending: false });

        if (fetchError) {
            console.error('[Batch Upload API] Failed to fetch items:', fetchError);
            throw new Error('Failed to fetch items');
        }

        if (!failedItems || failedItems.length === 0) {
            return NextResponse.json({
                success: true,
                summary: {
                    total: 0,
                    uploaded: 0,
                    failed: 0,
                    errors: []
                }
            });
        }

        console.log(`[Batch Upload API] Found ${failedItems.length} items to upload`);

        // Step 2: Upload each item sequentially
        const results = {
            total: failedItems.length,
            uploaded: 0,
            failed: 0,
            errors: []
        };

        for (const item of failedItems) {
            console.log(`[Batch Upload API] Processing item ${item.id}...`);

            try {
                // Call retry-upload API for this item
                const uploadResult = await uploadSingleItem(supabase, item);

                if (uploadResult.success) {
                    results.uploaded++;
                    console.log(`[Batch Upload API] ✅ Item ${item.id} uploaded successfully`);
                } else {
                    results.failed++;
                    results.errors.push(`Item ${item.id}: ${uploadResult.message}`);
                    console.log(`[Batch Upload API] ❌ Item ${item.id} failed: ${uploadResult.message}`);
                }
            } catch (error) {
                results.failed++;
                results.errors.push(`Item ${item.id}: ${error.message}`);
                console.error(`[Batch Upload API] ❌ Item ${item.id} error:`, error.message);
            }
        }

        console.log('[Batch Upload API] Batch upload completed:', results);

        return NextResponse.json({
            success: true,
            summary: results
        });

    } catch (error) {
        console.error('[Batch Upload API] Error:', error);
        return NextResponse.json(
            { success: false, message: error.message },
            { status: 500 }
        );
    }
}

async function uploadSingleItem(supabase, item) {
    const UPLOAD_TIMEOUT = 30000; // 30 seconds

    return new Promise((resolve) => {
        let uploadProcess = null;
        let timeoutId = null;
        let isResolved = false;

        const cleanup = () => {
            if (timeoutId) {
                clearTimeout(timeoutId);
                timeoutId = null;
            }
            if (uploadProcess && !uploadProcess.killed) {
                uploadProcess.kill();
                uploadProcess = null;
            }
        };

        // Verify temp file exists using BASE_DIR
        const fullPath = path.join(BASE_DIR, item.temp_path);

        fs.access(fullPath)
            .then(() => {
                // Verify script exists
                const scriptPath = path.join(process.cwd(), 'scripts', 'upload-temp-to-supabase.js');

                return fs.access(scriptPath);
            })
            .then(() => {
                // Spawn upload process
                const scriptPath = path.join(process.cwd(), 'scripts', 'upload-temp-to-supabase.js');
                const args = [item.id, item.temp_path];

                uploadProcess = spawn('node', [scriptPath, ...args], {
                    cwd: process.cwd(),
                    env: { ...process.env }
                });

                let stdout = '';
                let stderr = '';

                // Set timeout
                timeoutId = setTimeout(() => {
                    if (!isResolved) {
                        isResolved = true;
                        cleanup();
                        resolve({
                            success: false,
                            message: 'Upload timed out after 30 seconds'
                        });
                    }
                }, UPLOAD_TIMEOUT);

                uploadProcess.stdout.on('data', (data) => {
                    stdout += data.toString();
                });

                uploadProcess.stderr.on('data', (data) => {
                    stderr += data.toString();
                });

                uploadProcess.on('close', (code) => {
                    if (!isResolved) {
                        isResolved = true;
                        cleanup();

                        if (code === 0) {
                            resolve({ success: true });
                        } else {
                            resolve({
                                success: false,
                                message: stderr || stdout || 'Unknown error'
                            });
                        }
                    }
                });

                uploadProcess.on('error', (error) => {
                    if (!isResolved) {
                        isResolved = true;
                        cleanup();
                        resolve({
                            success: false,
                            message: error.message
                        });
                    }
                });
            })
            .catch((error) => {
                if (!isResolved) {
                    isResolved = true;
                    cleanup();
                    resolve({
                        success: false,
                        message: error.message
                    });
                }
            });
    });
}