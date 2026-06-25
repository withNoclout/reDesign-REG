import { success, error, unauthorized, forbidden, validationError } from '@/lib/apiResponse';
import { requireAdminUser } from '@/lib/adminAuth.mjs';
import { readJobStatus, spawnDetachedNodeJob } from '@/lib/agentMemoryJobs.mjs';
import { sanitizePlainText } from '@/lib/agentMemoryConfig.mjs';

export const runtime = 'nodejs';

function parseArgs(body) {
    const args = [];
    const graphPath = sanitizePlainText(body?.graphPath, 260);
    const reportPath = sanitizePlainText(body?.reportPath, 260);
    const repoName = sanitizePlainText(body?.repoName, 120);
    const commitSha = sanitizePlainText(body?.commitSha, 120);
    const branchName = sanitizePlainText(body?.branchName, 120);
    const scope = sanitizePlainText(body?.scope, 260);
    const createdBy = sanitizePlainText(body?.createdBy, 120);
    const graphifyArgs = sanitizePlainText(body?.graphifyArgs, 400);
    const python = sanitizePlainText(body?.python, 200);

    if (graphPath) args.push('--graph', graphPath);
    if (reportPath) args.push('--report', reportPath);
    if (repoName) args.push('--repo', repoName);
    if (commitSha) args.push('--commit', commitSha);
    if (branchName) args.push('--branch', branchName);
    if (scope) args.push('--scope', scope);
    if (createdBy) args.push('--created-by', createdBy);
    if (graphifyArgs) args.push('--graphify-args', graphifyArgs);
    if (python) args.push('--python', python);
    if (body?.skipBuild) args.push('--skip-build');
    if (body?.skipIngest) args.push('--skip-ingest');
    return args;
}

function buildMetadata(body, adminUserId) {
    return {
        repoName: sanitizePlainText(body?.repoName, 120) || 'web-app',
        requestedBy: adminUserId,
        skipBuild: Boolean(body?.skipBuild),
        skipIngest: Boolean(body?.skipIngest),
    };
}


export async function GET() {
    try {
        const admin = await requireAdminUser();
        if (!admin.userId) return unauthorized();
        if (!admin.allowed) return forbidden('Admin access required');

        const status = await readJobStatus('graphify-refresh');
        return success(status);
    } catch (requestError) {
        console.error('[AgentMemory] Refresh status failed:', requestError.message);
        return error(requestError.message || 'Internal server error', 500);
    }
}

export async function POST(request) {
    try {
        const admin = await requireAdminUser();
        if (!admin.userId) return unauthorized();
        if (!admin.allowed) return forbidden('Admin access required');

        const body = await request.json().catch(() => ({}));
        const metadata = buildMetadata(body, admin.userId);
        const job = await spawnDetachedNodeJob({
            jobName: 'graphify-refresh',
            scriptRelativePath: 'scripts/graphify-refresh.mjs',
            args: parseArgs(body),
            repoName: metadata.repoName,
            staleMs: Number.parseInt(String(body?.staleMs ?? ''), 10) || undefined,
            metadata,
            env: {
                AGENT_MEMORY_CREATED_BY: sanitizePlainText(body?.createdBy, 120) || admin.userId,
            },
        });

        return success(job, 202);
    } catch (requestError) {
        console.error('[AgentMemory] Refresh trigger failed:', requestError.message);
        if (requestError.code === 'JOB_LOCKED') {
            return error(requestError.message, 409, 'JOB_LOCKED');
        }
        if (requestError.message.includes('Missing')) {
            return validationError(requestError.message);
        }
        return error(requestError.message || 'Internal server error', 500);
    }
}
