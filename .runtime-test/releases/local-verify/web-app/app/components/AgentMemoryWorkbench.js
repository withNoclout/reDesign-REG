'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

import ErrorAlert from './ErrorAlert';
import { useAuth } from '../context/AuthContext';

const ADMIN_USER_ID = process.env.NEXT_PUBLIC_ADMIN_USER_ID || 's6701091611290';
const DEFAULT_REPO = 'web-app';

function normalizeUserCode(value) {
    return String(value || '').trim().replace(/^s/i, '');
}

async function parseApiResponse(response) {
    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload?.success) {
        const message = payload?.message || payload?.error?.message || `Request failed with status ${response.status}`;
        throw new Error(message);
    }
    return payload.data;
}

function SectionCard({ title, subtitle, children, actions = null, className = '' }) {
    return (
        <section className={`glass-card border border-white/10 shadow-2xl shadow-black/20 p-6 md:p-7 ${className}`}>
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                    <h2 className="text-xl font-semibold text-white font-prompt">{title}</h2>
                    {subtitle ? <p className="mt-1 text-sm text-white/60 font-prompt">{subtitle}</p> : null}
                </div>
                {actions ? <div className="flex flex-wrap gap-3">{actions}</div> : null}
            </div>
            <div className="mt-6">{children}</div>
        </section>
    );
}

function StatCard({ label, value, hint, accent = 'text-orange-300' }) {
    return (
        <div className="glass-card border border-white/10 rounded-2xl p-5 shadow-lg shadow-black/10">
            <p className="text-sm text-white/60 font-prompt">{label}</p>
            <p className={`mt-3 text-3xl font-bold font-prompt ${accent}`}>{value}</p>
            {hint ? <p className="mt-2 text-xs text-white/50 font-prompt">{hint}</p> : null}
        </div>
    );
}

function ActionButton({ children, busy = false, variant = 'primary', ...props }) {
    const base = 'inline-flex min-h-[44px] items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold font-prompt transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-400 disabled:cursor-not-allowed disabled:opacity-60';
    const variants = {
        primary: 'bg-orange-500 text-white hover:bg-orange-400',
        secondary: 'bg-white/10 text-white hover:bg-white/15 border border-white/10',
        danger: 'bg-red-500/80 text-white hover:bg-red-400',
    };

    return (
        <button {...props} className={`${base} ${variants[variant] || variants.primary}`} disabled={busy || props.disabled}>
            {busy ? 'กำลังดำเนินการ...' : children}
        </button>
    );
}

function ReadOnlyCode({ children }) {
    return (
        <pre className="overflow-x-auto rounded-2xl border border-white/10 bg-slate-950/60 p-4 text-xs text-white/80 font-mono whitespace-pre-wrap break-words">
            {children}
        </pre>
    );
}

export default function AgentMemoryWorkbench() {
    const router = useRouter();
    const { user, isAuthenticated, loading: authLoading } = useAuth();

    const [dashboard, setDashboard] = useState(null);
    const [impactResult, setImpactResult] = useState(null);
    const [searchResults, setSearchResults] = useState([]);
    const [searchSummary, setSearchSummary] = useState('');
    const [statusMessage, setStatusMessage] = useState('');
    const [error, setError] = useState('');
    const [loadingDashboard, setLoadingDashboard] = useState(true);
    const [runningAction, setRunningAction] = useState('');

    const [impactMode, setImpactMode] = useState('sourceFile');
    const [impactValue, setImpactValue] = useState('lib/auth.js');
    const [impactDepth, setImpactDepth] = useState('2');
    const [impactLimit, setImpactLimit] = useState('10');

    const [searchQuery, setSearchQuery] = useState('auth regression');
    const [searchKinds, setSearchKinds] = useState('fixSummary,incident');

    const [fixAssessmentId, setFixAssessmentId] = useState('');
    const [fixCommitSha, setFixCommitSha] = useState('');
    const [fixChangedFiles, setFixChangedFiles] = useState('lib/auth.js');
    const [fixTests, setFixTests] = useState('scripts/test-auth-flow.js');
    const [fixFailures, setFixFailures] = useState('');
    const [fixResolution, setFixResolution] = useState('Updated cookie handling for auth session refresh.');

    const isAdmin = useMemo(() => {
        if (!isAuthenticated || !user?.usercode) return false;
        return normalizeUserCode(user.usercode) === normalizeUserCode(ADMIN_USER_ID);
    }, [isAuthenticated, user]);

    useEffect(() => {
        if (!authLoading && !isAdmin) {
            router.replace('/main');
        }
    }, [authLoading, isAdmin, router]);

    const loadDashboard = useCallback(async () => {
        setLoadingDashboard(true);
        setError('');
        try {
            const result = await parseApiResponse(await fetch(`/api/agent-memory/dashboard?repoName=${encodeURIComponent(DEFAULT_REPO)}`, {
                credentials: 'same-origin',
            }));
            setDashboard(result);
        } catch (requestError) {
            setError(requestError.message || 'ไม่สามารถโหลดแดชบอร์ดได้');
        } finally {
            setLoadingDashboard(false);
        }
    }, []);

    useEffect(() => {
        if (!authLoading && isAdmin) {
            loadDashboard();
        }
    }, [authLoading, isAdmin, loadDashboard]);

    const handleImpactAnalyze = useCallback(async (event) => {
        event.preventDefault();
        setRunningAction('impact');
        setError('');
        setStatusMessage('');
        try {
            const result = await parseApiResponse(await fetch('/api/agent-memory/impact', {
                method: 'POST',
                credentials: 'same-origin',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    repoName: DEFAULT_REPO,
                    triggerType: impactMode,
                    triggerValue: impactValue,
                    maxDepth: Number(impactDepth) || 2,
                    limit: Number(impactLimit) || 10,
                }),
            }));
            setImpactResult(result);
            setStatusMessage('วิเคราะห์ผลกระทบเรียบร้อยแล้ว');
        } catch (requestError) {
            setError(requestError.message || 'ไม่สามารถวิเคราะห์ผลกระทบได้');
        } finally {
            setRunningAction('');
        }
    }, [impactDepth, impactLimit, impactMode, impactValue]);

    const handleSearch = useCallback(async (event) => {
        event.preventDefault();
        setRunningAction('search');
        setError('');
        setStatusMessage('');
        try {
            const searchParams = new URLSearchParams({
                q: searchQuery,
                repoName: DEFAULT_REPO,
                limit: '10',
            });
            if (searchKinds.trim()) {
                searchParams.set('kinds', searchKinds);
            }
            const result = await parseApiResponse(await fetch(`/api/agent-memory/search?${searchParams.toString()}`, {
                credentials: 'same-origin',
            }));
            setSearchResults(result);
            setSearchSummary(`พบ ${result.length} memory item(s)`);
            setStatusMessage('ค้นหา memory สำเร็จ');
        } catch (requestError) {
            setError(requestError.message || 'ไม่สามารถค้นหา memory ได้');
        } finally {
            setRunningAction('');
        }
    }, [searchKinds, searchQuery]);

    const handleTriggerJob = useCallback(async (jobName) => {
        setRunningAction(jobName);
        setError('');
        setStatusMessage('');
        try {
            const endpoint = jobName === 'refresh'
                ? '/api/agent-memory/jobs/refresh'
                : '/api/agent-memory/jobs/embeddings';
            const body = jobName === 'refresh'
                ? { repoName: DEFAULT_REPO }
                : { repoName: DEFAULT_REPO, limit: 100, batchSize: 20 };
            const result = await parseApiResponse(await fetch(endpoint, {
                method: 'POST',
                credentials: 'same-origin',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            }));
            setStatusMessage(`${jobName === 'refresh' ? 'Queue refresh' : 'Queue embeddings'} สำเร็จ (pid ${result.pid})`);
            await loadDashboard();
        } catch (requestError) {
            setError(requestError.message || 'ไม่สามารถสั่งงาน background job ได้');
        } finally {
            setRunningAction('');
        }
    }, [loadDashboard]);

    const handleRecordFix = useCallback(async (event) => {
        event.preventDefault();
        setRunningAction('record-fix');
        setError('');
        setStatusMessage('');
        try {
            const result = await parseApiResponse(await fetch('/api/agent-memory/fix-outcome', {
                method: 'POST',
                credentials: 'same-origin',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    repoName: DEFAULT_REPO,
                    assessmentId: fixAssessmentId || null,
                    commitSha: fixCommitSha || null,
                    changedFiles: fixChangedFiles.split(',').map((entry) => entry.trim()).filter(Boolean),
                    testsRun: fixTests.split(',').map((entry) => entry.trim()).filter(Boolean),
                    failuresFound: fixFailures.split(',').map((entry) => entry.trim()).filter(Boolean),
                    finalResolution: fixResolution,
                }),
            }));
            setStatusMessage(`บันทึก fix outcome สำเร็จ (${result.id})`);
            await loadDashboard();
        } catch (requestError) {
            setError(requestError.message || 'ไม่สามารถบันทึก fix outcome ได้');
        } finally {
            setRunningAction('');
        }
    }, [fixAssessmentId, fixChangedFiles, fixCommitSha, fixFailures, fixResolution, fixTests, loadDashboard]);

    if (authLoading || !isAdmin) {
        return (
            <div className="flex min-h-[40vh] items-center justify-center text-white/70 font-prompt">
                กำลังโหลดเครื่องมือ Agent Memory...
            </div>
        );
    }

    const latestSnapshot = dashboard?.graph?.latestSnapshot;
    const refreshJob = dashboard?.jobs?.refresh;
    const embeddingsJob = dashboard?.jobs?.embeddings;

    return (
        <div className="flex flex-col gap-6">
            <ErrorAlert message={error || statusMessage} type={error ? 'error' : 'success'} onDismiss={() => {
                setError('');
                setStatusMessage('');
            }} />

            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <StatCard
                    label="Latest Graph Snapshot"
                    value={latestSnapshot?.commitSha ? latestSnapshot.commitSha.slice(0, 8) : 'none'}
                    hint={latestSnapshot?.createdAt || 'ยังไม่เคย ingest graph'}
                />
                <StatCard
                    label="Pending Embeddings"
                    value={dashboard?.memory?.pendingEmbeddings ?? 0}
                    hint="memory items ที่ยังไม่มี vector"
                    accent="text-amber-300"
                />
                <StatCard
                    label="Refresh Job"
                    value={refreshJob?.status?.state || 'idle'}
                    hint={refreshJob?.running ? 'กำลังทำงาน' : 'พร้อมใช้งาน'}
                    accent="text-sky-300"
                />
                <StatCard
                    label="Embeddings Job"
                    value={embeddingsJob?.status?.state || 'idle'}
                    hint={embeddingsJob?.running ? 'กำลังทำงาน' : 'พร้อมใช้งาน'}
                    accent="text-emerald-300"
                />
            </section>

            <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
                <SectionCard
                    title="Impact Analyzer"
                    subtitle="วิเคราะห์ blast radius ก่อนทำ surgical fix"
                    actions={<ActionButton variant="secondary" onClick={loadDashboard} busy={loadingDashboard}>Refresh dashboard</ActionButton>}
                >
                    <form className="grid gap-4" onSubmit={handleImpactAnalyze}>
                        <div className="grid gap-4 md:grid-cols-[180px_1fr_120px_120px]">
                            <label className="flex flex-col gap-2 text-sm text-white/70 font-prompt">
                                Trigger type
                                <select value={impactMode} onChange={(event) => setImpactMode(event.target.value)} className="rounded-xl border border-white/10 bg-slate-950/50 px-3 py-3 text-white">
                                    <option value="sourceFile">sourceFile</option>
                                    <option value="symbol">symbol</option>
                                    <option value="nodeKey">nodeKey</option>
                                    <option value="label">label</option>
                                </select>
                            </label>
                            <label className="flex flex-col gap-2 text-sm text-white/70 font-prompt">
                                Trigger value
                                <input value={impactValue} onChange={(event) => setImpactValue(event.target.value)} className="rounded-xl border border-white/10 bg-slate-950/50 px-3 py-3 text-white" placeholder="lib/auth.js หรือ getAuthUser" />
                            </label>
                            <label className="flex flex-col gap-2 text-sm text-white/70 font-prompt">
                                Depth
                                <input value={impactDepth} onChange={(event) => setImpactDepth(event.target.value)} className="rounded-xl border border-white/10 bg-slate-950/50 px-3 py-3 text-white" inputMode="numeric" />
                            </label>
                            <label className="flex flex-col gap-2 text-sm text-white/70 font-prompt">
                                Limit
                                <input value={impactLimit} onChange={(event) => setImpactLimit(event.target.value)} className="rounded-xl border border-white/10 bg-slate-950/50 px-3 py-3 text-white" inputMode="numeric" />
                            </label>
                        </div>
                        <div className="flex flex-wrap gap-3">
                            <ActionButton type="submit" busy={runningAction === 'impact'}>Analyze impact</ActionButton>
                            <ActionButton type="button" variant="secondary" onClick={() => {
                                setImpactMode('sourceFile');
                                setImpactValue('lib/auth.js');
                                setImpactDepth('2');
                                setImpactLimit('10');
                            }}>Reset</ActionButton>
                        </div>
                    </form>

                    {impactResult ? (
                        <div className="mt-6 grid gap-4 lg:grid-cols-2">
                            <div className="space-y-4">
                                <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
                                    <p className="text-sm text-white/50">Seed Nodes</p>
                                    <ul className="mt-3 space-y-2 text-sm text-white/80">
                                        {impactResult.seedNodes?.map((node) => (
                                            <li key={node.nodeRef} className="rounded-xl bg-white/5 px-3 py-2">{node.label}</li>
                                        ))}
                                    </ul>
                                </div>
                                <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
                                    <p className="text-sm text-white/50">Direct Impact</p>
                                    <ul className="mt-3 space-y-2 text-sm text-white/80">
                                        {(impactResult.directImpact || []).slice(0, 8).map((item) => (
                                            <li key={item.nodeRef} className="rounded-xl bg-white/5 px-3 py-2">
                                                <div className="font-medium text-white">{item.label}</div>
                                                <div className="mt-1 text-xs text-white/50">{item.sourceFile || 'unknown file'} · score {item.score}</div>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </div>
                            <div className="space-y-4">
                                <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
                                    <p className="text-sm text-white/50">Recommended Tests</p>
                                    <ul className="mt-3 space-y-2 text-sm text-white/80">
                                        {(impactResult.recommendedTests || []).length === 0 ? (
                                            <li className="rounded-xl bg-white/5 px-3 py-2 text-white/50">ไม่มีข้อเสนอแนะ test จาก graph ปัจจุบัน</li>
                                        ) : (
                                            impactResult.recommendedTests.map((testFile) => (
                                                <li key={testFile} className="rounded-xl bg-white/5 px-3 py-2">{testFile}</li>
                                            ))
                                        )}
                                    </ul>
                                </div>
                                <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
                                    <p className="text-sm text-white/50">Blast Radius Notes</p>
                                    <ReadOnlyCode>{(impactResult.blastRadiusReport?.reportLines || []).join('\n') || 'ยังไม่มีรายงาน'}</ReadOnlyCode>
                                </div>
                            </div>
                        </div>
                    ) : null}
                </SectionCard>

                <SectionCard title="Job Controls" subtitle="ควบคุม refresh และ embedding backfill">
                    <div className="grid gap-4">
                        <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
                            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                <div>
                                    <p className="text-base font-medium text-white">Graph Refresh</p>
                                    <p className="mt-1 text-sm text-white/50">สร้าง graph snapshot ใหม่และ ingest เข้า Postgres</p>
                                </div>
                                <ActionButton onClick={() => handleTriggerJob('refresh')} busy={runningAction === 'refresh'}>Queue refresh</ActionButton>
                            </div>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
                            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                <div>
                                    <p className="text-base font-medium text-white">Embedding Backfill</p>
                                    <p className="mt-1 text-sm text-white/50">เติม vector ให้ memory items ที่ยังค้างอยู่</p>
                                </div>
                                <ActionButton onClick={() => handleTriggerJob('embeddings')} busy={runningAction === 'embeddings'}>Queue embeddings</ActionButton>
                            </div>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4 text-sm text-white/70">
                            <p className="font-medium text-white">Current Job State</p>
                            <ul className="mt-3 space-y-2">
                                <li>Refresh: {refreshJob?.status?.state || 'idle'}{refreshJob?.running ? ' (running)' : ''}</li>
                                <li>Embeddings: {embeddingsJob?.status?.state || 'idle'}{embeddingsJob?.running ? ' (running)' : ''}</li>
                            </ul>
                        </div>
                    </div>
                </SectionCard>
            </div>

            <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
                <SectionCard title="Memory Search" subtitle="ค้นหา precedent, incident และ fix history">
                    <form className="grid gap-4" onSubmit={handleSearch}>
                        <label className="flex flex-col gap-2 text-sm text-white/70 font-prompt">
                            Query
                            <input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} className="rounded-xl border border-white/10 bg-slate-950/50 px-3 py-3 text-white" placeholder="auth regression" />
                        </label>
                        <label className="flex flex-col gap-2 text-sm text-white/70 font-prompt">
                            Kinds (comma separated)
                            <input value={searchKinds} onChange={(event) => setSearchKinds(event.target.value)} className="rounded-xl border border-white/10 bg-slate-950/50 px-3 py-3 text-white" placeholder="fixSummary,incident" />
                        </label>
                        <div className="flex flex-wrap gap-3">
                            <ActionButton type="submit" busy={runningAction === 'search'}>Search memory</ActionButton>
                            <ActionButton type="button" variant="secondary" onClick={() => setSearchResults([])}>Clear results</ActionButton>
                        </div>
                    </form>

                    <div className="mt-6 space-y-3">
                        <p className="text-sm text-white/50">{searchSummary || 'ยังไม่ได้ค้นหา'}</p>
                        {(searchResults || []).map((item) => (
                            <article key={item.id || item.memoryKey} className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
                                <div className="flex flex-wrap items-center gap-2 text-xs text-white/45">
                                    <span className="rounded-full bg-white/10 px-2 py-1 uppercase tracking-wide">{item.kind}</span>
                                    <span>{item.scope}</span>
                                </div>
                                <h3 className="mt-3 text-base font-medium text-white">{item.title}</h3>
                                <p className="mt-2 text-sm text-white/70">{item.content}</p>
                            </article>
                        ))}
                    </div>
                </SectionCard>

                <SectionCard title="Record Fix Outcome" subtitle="ปิด feedback loop หลังแก้เสร็จเพื่อให้ agent จำบทเรียนได้">
                    <form className="grid gap-4" onSubmit={handleRecordFix}>
                        <div className="grid gap-4 md:grid-cols-2">
                            <label className="flex flex-col gap-2 text-sm text-white/70 font-prompt">
                                Assessment ID
                                <input value={fixAssessmentId} onChange={(event) => setFixAssessmentId(event.target.value)} className="rounded-xl border border-white/10 bg-slate-950/50 px-3 py-3 text-white" placeholder="optional" />
                            </label>
                            <label className="flex flex-col gap-2 text-sm text-white/70 font-prompt">
                                Commit SHA
                                <input value={fixCommitSha} onChange={(event) => setFixCommitSha(event.target.value)} className="rounded-xl border border-white/10 bg-slate-950/50 px-3 py-3 text-white" placeholder="abc123" />
                            </label>
                        </div>
                        <label className="flex flex-col gap-2 text-sm text-white/70 font-prompt">
                            Changed Files
                            <input value={fixChangedFiles} onChange={(event) => setFixChangedFiles(event.target.value)} className="rounded-xl border border-white/10 bg-slate-950/50 px-3 py-3 text-white" placeholder="lib/auth.js,app/api/user/settings/route.js" />
                        </label>
                        <label className="flex flex-col gap-2 text-sm text-white/70 font-prompt">
                            Tests Run
                            <input value={fixTests} onChange={(event) => setFixTests(event.target.value)} className="rounded-xl border border-white/10 bg-slate-950/50 px-3 py-3 text-white" placeholder="scripts/test-auth-flow.js" />
                        </label>
                        <label className="flex flex-col gap-2 text-sm text-white/70 font-prompt">
                            Failures Found
                            <input value={fixFailures} onChange={(event) => setFixFailures(event.target.value)} className="rounded-xl border border-white/10 bg-slate-950/50 px-3 py-3 text-white" placeholder="optional" />
                        </label>
                        <label className="flex flex-col gap-2 text-sm text-white/70 font-prompt">
                            Final Resolution
                            <textarea value={fixResolution} onChange={(event) => setFixResolution(event.target.value)} className="min-h-[140px] rounded-xl border border-white/10 bg-slate-950/50 px-3 py-3 text-white" />
                        </label>
                        <div className="flex flex-wrap gap-3">
                            <ActionButton type="submit" busy={runningAction === 'record-fix'}>Record fix outcome</ActionButton>
                            <ActionButton type="button" variant="secondary" onClick={() => {
                                setFixAssessmentId('');
                                setFixCommitSha('');
                                setFixChangedFiles('');
                                setFixTests('');
                                setFixFailures('');
                                setFixResolution('');
                            }}>Reset</ActionButton>
                        </div>
                    </form>
                </SectionCard>
            </div>

            <SectionCard title="Codex / Vibe Coding Quickstart" subtitle="คำสั่งที่ควรใช้ก่อน-หลังการแก้โค้ด">
                <ReadOnlyCode>{`npm run codex:dashboard\nnpm run codex:impact -- --file lib/auth.js\nnpm run codex:search -- --query "auth regression"\n# แก้โค้ด + รัน targeted tests\nnpm run codex:record-fix -- --resolution "Updated cookie handling" --changed-files lib/auth.js`}</ReadOnlyCode>
            </SectionCard>
        </div>
    );
}
