import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';

const UPLOAD_TIMEOUT = 30000; // 30 seconds

// BASE_DIR: Root directory for web-app (consistent across all upload-related files)
const BASE_DIR = process.cwd(); // = web-app/
console.log('[Upload API] BASE_DIR:', BASE_DIR);

export async function POST(request) {
    let uploadProcess = null;
    let timeoutId = null;

    try {
        const body = await request.json();
        const { itemId, tempPath } = body;

        console.log('[Upload API] Received upload request:', { itemId, tempPath });

        if (!itemId || !tempPath) {
            return NextResponse.json(
                { success: false, message: 'Missing itemId or tempPath' },
                { status: 400 }
            );
        }

        // Verify script exists
        const scriptPath = path.join(process.cwd(), 'scripts', 'upload-temp-to-supabase.js');

        try {
            await fs.access(scriptPath);
        } catch (error) {
            console.error('[Upload API] Script not found:', scriptPath);
            return NextResponse.json(
                { success: false, message: 'Upload script not found' },
                { status: 500 }
            );
        }

        console.log('[Upload API] Spawning upload script...');

        const args = [itemId, tempPath];

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
                    console.error('[Upload API] Timeout after', UPLOAD_TIMEOUT, 'ms');
                    cleanup();
                    resolve(NextResponse.json({
                        success: false,
                        message: 'Upload timed out after 30 seconds'
                    }, { status: 504 }));
                }
            }, UPLOAD_TIMEOUT);

            uploadProcess.stdout.on('data', (data) => {
                stdout += data.toString();
                console.log('[Upload Script]', data.toString().trim());
            });

            uploadProcess.stderr.on('data', (data) => {
                stderr += data.toString();
                console.error('[Upload Script Error]', data.toString().trim());
            });

            uploadProcess.on('close', (code) => {
                if (!isResolved) {
                    isResolved = true;
                    cleanup();
                    console.log('[Upload API] Script exited with code:', code);

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
                    console.error('[Upload API] Failed to start script:', error);
                    resolve(NextResponse.json({
                        success: false,
                        message: 'Failed to start upload script',
                        error: error.message
                    }, { status: 500 }));
                }
            });
        });

    } catch (error) {
        console.error('[Upload API] Error:', error);
        return NextResponse.json(
            { success: false, message: error.message },
            { status: 500 }
        );
    }
}
