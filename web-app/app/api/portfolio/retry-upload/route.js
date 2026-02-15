import { NextResponse } from 'next/server';
import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import { getServiceSupabase } from '@/lib/supabase';
import { getAuthUser } from '@/lib/auth';

const UPLOAD_TIMEOUT = 30000; // 30 seconds

// BASE_DIR: Root directory for web-app (consistent across all upload-related files)
const BASE_DIR = process.cwd(); // = web-app/
console.log('[Retry Upload API] BASE_DIR:', BASE_DIR);

export async function POST(request) {
    let uploadProcess = null;
    let timeoutId = null;

    try {
        // Check authentication
        const userId = await getAuthUser();
        if (!userId) {
            return NextResponse.json(
                { success: false, message: 'Unauthorized' },
                { status: 401 }
            );
        }

        const body = await request.json();
        const { itemId } = body;

        if (!itemId) {
            return NextResponse.json(
                { success: false, message: 'Missing itemId' },
                { status: 400 }
            );
        }

        console.log('[Retry Upload API] Received request for item:', itemId);

        // Get item details from database
        const supabase = getServiceSupabase();
        const { data: item, error: fetchError } = await supabase
            .from('news_items')
            .select('*')
            .eq('id', itemId)
            .eq('created_by', String(userId))
            .single();

        if (fetchError || !item) {
            console.error('[Retry Upload API] Item not found:', fetchError);
            return NextResponse.json(
                { success: false, message: 'Item not found' },
                { status: 404 }
            );
        }

        // Check if item has a temp path
        if (!item.temp_path) {
            return NextResponse.json(
                { success: false, message: 'No temp file found for this item' },
                { status: 400 }
            );
        }

        // Check if already uploaded
        if (item.uploaded_to_supabase) {
            return NextResponse.json(
                { success: false, message: 'Item already uploaded' },
                { status: 400 }
            );
        }

        // Verify temp file exists using BASE_DIR
        const fullPath = path.join(BASE_DIR, item.temp_path);

        try {
            await fs.access(fullPath);
        } catch (error) {
            console.error('[Retry Upload API] Temp file not found:', fullPath);
            return NextResponse.json(
                { success: false, message: 'Temp file no longer exists' },
                { status: 404 }
            );
        }

        // Verify upload script exists
        const scriptPath = path.join(process.cwd(), 'scripts', 'upload-temp-to-supabase.js');

        try {
            await fs.access(scriptPath);
        } catch (error) {
            console.error('[Retry Upload API] Upload script not found:', scriptPath);
            return NextResponse.json(
                { success: false, message: 'Upload script not found' },
                { status: 500 }
            );
        }

        console.log('[Retry Upload API] Spawning upload script...');

        const args = [itemId, item.temp_path];

        return new Promise((resolve) => {
            uploadProcess = spawn('node', [scriptPath, ...args], {
                cwd: process.cwd(),
                env: { ...process.env }
            });

            let stdout = '';
            let stderr = '';
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

            // Set timeout
            timeoutId = setTimeout(() => {
                if (!isResolved) {
                    isResolved = true;
                    console.error('[Retry Upload API] Timeout after', UPLOAD_TIMEOUT, 'ms');
                    cleanup();
                    resolve(NextResponse.json({
                        success: false,
                        message: 'Upload timed out after 30 seconds'
                    }, { status: 504 }));
                }
            }, UPLOAD_TIMEOUT);

            uploadProcess.stdout.on('data', (data) => {
                stdout += data.toString();
                console.log('[Retry Upload Script]', data.toString().trim());
            });

            uploadProcess.stderr.on('data', (data) => {
                stderr += data.toString();
                console.error('[Retry Upload Script Error]', data.toString().trim());
            });

            uploadProcess.on('close', (code) => {
                if (!isResolved) {
                    isResolved = true;
                    cleanup();
                    console.log('[Retry Upload API] Script exited with code:', code);

                    if (code === 0) {
                        resolve(NextResponse.json({
                            success: true,
                            message: 'Upload completed successfully'
                        }));
                    } else {
                        resolve(NextResponse.json({
                            success: false,
                            message: 'Upload failed',
                            error: stderr || stdout || 'Unknown error'
                        }, { status: 500 }));
                    }
                }
            });

            uploadProcess.on('error', (error) => {
                if (!isResolved) {
                    isResolved = true;
                    cleanup();
                    console.error('[Retry Upload API] Failed to start script:', error);
                    resolve(NextResponse.json({
                        success: false,
                        message: 'Failed to start upload script',
                        error: error.message
                    }, { status: 500 }));
                }
            });
        });

    } catch (error) {
        console.error('[Retry Upload API] Error:', error);
        return NextResponse.json(
            { success: false, message: error.message },
            { status: 500 }
        );
    }
}