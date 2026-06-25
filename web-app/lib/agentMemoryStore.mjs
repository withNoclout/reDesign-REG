import pg from 'pg';

import {
    AGENT_MEMORY_DEFAULT_REPO,
    AGENT_MEMORY_EMBEDDING_MODEL,
    sanitizePlainText,
    toVectorLiteral,
} from './agentMemoryConfig.mjs';
import { buildGraphRecords } from './graphifyMemory.mjs';

const { Pool } = pg;

function getDatabaseUrl() {
    if (!process.env.DATABASE_URL) {
        throw new Error('Missing DATABASE_URL for agent memory operations.');
    }
    return process.env.DATABASE_URL;
}

function getSslConfig() {
    const sslMode = String(process.env.PGSSLMODE || '').toLowerCase();
    if (sslMode === 'disable') return false;

    try {
        const databaseUrl = new URL(getDatabaseUrl());
        if (['localhost', '127.0.0.1'].includes(databaseUrl.hostname)) {
            return false;
        }
    } catch {
        // Fall back to TLS for remote URLs we cannot parse.
    }

    return { rejectUnauthorized: true };
}


function getDatabasePool() {
    if (globalThis.__agentMemoryPool) return globalThis.__agentMemoryPool;

    const pool = new Pool({
        connectionString: getDatabaseUrl(),
        ssl: getSslConfig(),
        max: 5,
    });

    globalThis.__agentMemoryPool = pool;
    return pool;
}

async function withTransaction(work) {
    const client = await getDatabasePool().connect();
    try {
        await client.query('BEGIN');
        const result = await work(client);
        await client.query('COMMIT');
        return result;
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

function mapSnapshot(row) {
    if (!row) return null;
    return {
        id: row.id,
        repoName: row.repo_name,
        branchName: row.branch_name,
        commitSha: row.commit_sha,
        graphVersion: row.graph_version,
        sourceScope: row.source_scope || [],
        graphJsonPath: row.graph_json_path,
        reportPath: row.report_path,
        status: row.status,
        graphStats: row.graph_stats || {},
        createdBy: row.created_by,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}

function mapNode(row) {
    return {
        nodeRef: row.node_ref,
        snapshotId: row.snapshot_id,
        nodeKey: row.node_key,
        label: row.label,
        nodeType: row.node_type,
        fileType: row.file_type,
        sourceFile: row.source_file,
        sourceLocation: row.source_location,
        summary: row.summary,
        metadata: row.metadata || {},
    };
}

function mapEdge(row) {
    return {
        id: row.id,
        snapshotId: row.snapshot_id,
        sourceNodeRef: row.source_node_ref,
        targetNodeRef: row.target_node_ref,
        relation: row.relation,
        confidence: row.confidence,
        confidenceScore: Number(row.confidence_score ?? 0.7),
        sourceFile: row.source_file,
        weight: Number(row.weight ?? 1),
        metadata: row.metadata || {},
    };
}

function mapMemoryItem(row) {
    return {
        id: row.id,
        repoName: row.repo_name,
        memoryKey: row.memory_key,
        scope: row.scope,
        kind: row.kind,
        title: row.title,
        content: row.content,
        sourceSnapshotId: row.source_snapshot_id,
        sourceNodeRefs: row.source_node_refs || [],
        provenance: row.provenance || {},
        metadata: row.metadata || {},
        createdBy: row.created_by,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        expiresAt: row.expires_at,
    };
}

async function insertGraphNodes(client, snapshotId, nodes) {
    if (!Array.isArray(nodes) || nodes.length === 0) return;
    await client.query(
        `INSERT INTO public.graph_nodes (
            node_ref,
            snapshot_id,
            node_key,
            label,
            node_type,
            file_type,
            source_file,
            source_location,
            summary,
            metadata
        )
        SELECT
            x.node_ref,
            $2::uuid,
            x.node_key,
            x.label,
            x.node_type,
            x.file_type,
            x.source_file,
            x.source_location,
            x.summary,
            COALESCE(x.metadata, '{}'::jsonb)
        FROM jsonb_to_recordset($1::jsonb) AS x(
            node_ref text,
            node_key text,
            label text,
            node_type text,
            file_type text,
            source_file text,
            source_location text,
            summary text,
            metadata jsonb
        )`,
        [
            JSON.stringify(nodes.map((node) => ({
                node_ref: node.nodeRef,
                node_key: node.nodeKey,
                label: node.label,
                node_type: node.nodeType,
                file_type: node.fileType,
                source_file: node.sourceFile,
                source_location: node.sourceLocation,
                summary: node.summary,
                metadata: node.metadata,
            }))),
            snapshotId,
        ]
    );
}

async function insertGraphEdges(client, snapshotId, edges) {
    if (!Array.isArray(edges) || edges.length === 0) return;
    await client.query(
        `INSERT INTO public.graph_edges (
            snapshot_id,
            source_node_ref,
            target_node_ref,
            relation,
            confidence,
            confidence_score,
            source_file,
            weight,
            metadata
        )
        SELECT
            $2::uuid,
            x.source_node_ref,
            x.target_node_ref,
            x.relation,
            x.confidence,
            x.confidence_score,
            x.source_file,
            x.weight,
            COALESCE(x.metadata, '{}'::jsonb)
        FROM jsonb_to_recordset($1::jsonb) AS x(
            source_node_ref text,
            target_node_ref text,
            relation text,
            confidence text,
            confidence_score real,
            source_file text,
            weight real,
            metadata jsonb
        )
        ON CONFLICT DO NOTHING`,
        [
            JSON.stringify(edges.map((edge) => ({
                source_node_ref: edge.sourceNodeRef,
                target_node_ref: edge.targetNodeRef,
                relation: edge.relation,
                confidence: edge.confidence,
                confidence_score: edge.confidenceScore,
                source_file: edge.sourceFile,
                weight: edge.weight,
                metadata: edge.metadata,
            }))),
            snapshotId,
        ]
    );
}

async function insertGraphHyperedges(client, snapshotId, hyperedges, hyperedgeNodes) {
    if (Array.isArray(hyperedges) && hyperedges.length > 0) {
        await client.query(
            `INSERT INTO public.graph_hyperedges (
                id,
                snapshot_id,
                hyperedge_key,
                label,
                relation,
                confidence,
                confidence_score,
                source_file,
                metadata
            )
            SELECT
                x.id,
                $2::uuid,
                x.hyperedge_key,
                x.label,
                x.relation,
                x.confidence,
                x.confidence_score,
                x.source_file,
                COALESCE(x.metadata, '{}'::jsonb)
            FROM jsonb_to_recordset($1::jsonb) AS x(
                id text,
                hyperedge_key text,
                label text,
                relation text,
                confidence text,
                confidence_score real,
                source_file text,
                metadata jsonb
            )`,
            [
                JSON.stringify(hyperedges.map((hyperedge) => ({
                    id: hyperedge.hyperedgeId,
                    hyperedge_key: hyperedge.hyperedgeKey,
                    label: hyperedge.label,
                    relation: hyperedge.relation,
                    confidence: hyperedge.confidence,
                    confidence_score: hyperedge.confidenceScore,
                    source_file: hyperedge.sourceFile,
                    metadata: hyperedge.metadata,
                }))),
                snapshotId,
            ]
        );
    }

    if (Array.isArray(hyperedgeNodes) && hyperedgeNodes.length > 0) {
        await client.query(
            `INSERT INTO public.graph_hyperedge_nodes (
                hyperedge_id,
                node_ref,
                ordinal
            )
            SELECT
                x.hyperedge_id,
                x.node_ref,
                x.ordinal
            FROM jsonb_to_recordset($1::jsonb) AS x(
                hyperedge_id text,
                node_ref text,
                ordinal integer
            )`,
            [
                JSON.stringify(hyperedgeNodes.map((row) => ({
                    hyperedge_id: row.hyperedgeId,
                    node_ref: row.nodeRef,
                    ordinal: row.ordinal,
                }))),
            ]
        );
    }
}

async function insertMemoryItems(client, snapshotId, memoryItems) {
    if (!Array.isArray(memoryItems) || memoryItems.length === 0) return;
    await client.query(
        `INSERT INTO public.memory_items (
            repo_name,
            memory_key,
            scope,
            kind,
            title,
            content,
            source_snapshot_id,
            source_node_refs,
            provenance,
            metadata,
            created_by
        )
        SELECT
            x.repo_name,
            x.memory_key,
            x.scope,
            x.kind,
            x.title,
            x.content,
            $2::uuid,
            COALESCE(x.source_node_refs, '{}'::text[]),
            COALESCE(x.provenance, '{}'::jsonb),
            COALESCE(x.metadata, '{}'::jsonb),
            x.created_by
        FROM jsonb_to_recordset($1::jsonb) AS x(
            repo_name text,
            memory_key text,
            scope text,
            kind text,
            title text,
            content text,
            source_node_refs text[],
            provenance jsonb,
            metadata jsonb,
            created_by text
        )`,
        [
            JSON.stringify(memoryItems.map((item) => ({
                repo_name: item.repoName,
                memory_key: item.memoryKey,
                scope: item.scope,
                kind: item.kind,
                title: item.title,
                content: item.content,
                source_node_refs: item.sourceNodeRefs,
                provenance: item.provenance,
                metadata: item.metadata,
                created_by: item.createdBy,
            }))),
            snapshotId,
        ]
    );
}

async function upsertSnapshotMemoryEmbeddings(client, repoName, snapshotId, memoryEmbeddings) {
    if (!Array.isArray(memoryEmbeddings) || memoryEmbeddings.length === 0) return;

    const items = await client.query(
        `SELECT id, memory_key FROM public.memory_items WHERE repo_name = $1 AND source_snapshot_id = $2`,
        [repoName, snapshotId]
    );
    const itemIdByKey = new Map(items.rows.map((row) => [row.memory_key, row.id]));

    for (const entry of memoryEmbeddings) {
        const memoryKey = sanitizePlainText(entry?.memoryKey, 260);
        if (!memoryKey) continue;
        const memoryItemId = itemIdByKey.get(memoryKey);
        if (!memoryItemId) continue;

        await client.query(
            `INSERT INTO public.memory_embeddings (memory_item_id, embedding_model, embedding)
             VALUES ($1::uuid, $2, $3::extensions.vector)
             ON CONFLICT (memory_item_id)
             DO UPDATE SET embedding_model = EXCLUDED.embedding_model, embedding = EXCLUDED.embedding`,
            [
                memoryItemId,
                sanitizePlainText(entry?.model, 120) || AGENT_MEMORY_EMBEDDING_MODEL,
                toVectorLiteral(entry.embedding),
            ]
        );
    }
}

export async function replaceGraphSnapshot({
    repoName = AGENT_MEMORY_DEFAULT_REPO,
    branchName = null,
    commitSha,
    graphVersion,
    sourceScope = [],
    graphJsonPath = null,
    reportPath = null,
    createdBy = null,
    graph,
    reportMarkdown = '',
    memoryEmbeddings = [],
}) {
    const cleanRepoName = sanitizePlainText(repoName, 120) || AGENT_MEMORY_DEFAULT_REPO;
    const cleanCommitSha = sanitizePlainText(commitSha, 120);
    if (!cleanCommitSha) throw new Error('commitSha is required.');

    return withTransaction(async (client) => {
        const existing = await client.query(
            `SELECT id FROM public.graph_snapshots WHERE repo_name = $1 AND commit_sha = $2 LIMIT 1`,
            [cleanRepoName, cleanCommitSha]
        );

        if (existing.rowCount > 0) {
            const oldSnapshotId = existing.rows[0].id;
            await client.query(`DELETE FROM public.memory_items WHERE source_snapshot_id = $1`, [oldSnapshotId]);
            await client.query(`DELETE FROM public.graph_snapshots WHERE id = $1`, [oldSnapshotId]);
        }

        const snapshotResult = await client.query(
            `INSERT INTO public.graph_snapshots (
                repo_name,
                branch_name,
                commit_sha,
                graph_version,
                source_scope,
                graph_json_path,
                report_path,
                status,
                graph_stats,
                created_by
            ) VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, 'pending', '{}'::jsonb, $8)
            RETURNING *`,
            [
                cleanRepoName,
                sanitizePlainText(branchName, 120) || null,
                cleanCommitSha,
                sanitizePlainText(graphVersion, 40) || '1',
                JSON.stringify(Array.isArray(sourceScope) ? sourceScope : []),
                sanitizePlainText(graphJsonPath, 260) || null,
                sanitizePlainText(reportPath, 260) || null,
                sanitizePlainText(createdBy, 120) || null,
            ]
        );

        const snapshot = mapSnapshot(snapshotResult.rows[0]);
        const records = buildGraphRecords({
            snapshotId: snapshot.id,
            repoName: cleanRepoName,
            commitSha: cleanCommitSha,
            graph,
            reportMarkdown,
            graphVersion: snapshot.graphVersion,
            createdBy: snapshot.createdBy,
        });

        await insertGraphNodes(client, snapshot.id, records.nodes);
        await insertGraphEdges(client, snapshot.id, records.edges);
        await insertGraphHyperedges(client, snapshot.id, records.hyperedges, records.hyperedgeNodes);
        await insertMemoryItems(client, snapshot.id, records.memoryItems);
        await upsertSnapshotMemoryEmbeddings(client, cleanRepoName, snapshot.id, memoryEmbeddings);

        await client.query(
            `UPDATE public.graph_snapshots
             SET status = 'ready', graph_stats = $2::jsonb
             WHERE id = $1`,
            [snapshot.id, JSON.stringify(records.graphStats)]
        );

        return {
            snapshot: {
                ...snapshot,
                status: 'ready',
                graphStats: records.graphStats,
            },
            counts: records.graphStats,
        };
    });
}

export async function getLatestGraphSnapshot(repoName = AGENT_MEMORY_DEFAULT_REPO) {
    const result = await getDatabasePool().query(
        `SELECT *
         FROM public.graph_snapshots
         WHERE repo_name = $1 AND status = 'ready'
         ORDER BY created_at DESC
         LIMIT 1`,
        [sanitizePlainText(repoName, 120) || AGENT_MEMORY_DEFAULT_REPO]
    );
    return mapSnapshot(result.rows[0]);
}

export async function getGraphSnapshotById(snapshotId) {
    const cleanSnapshotId = sanitizePlainText(snapshotId, 120);
    if (!cleanSnapshotId) return null;

    const result = await getDatabasePool().query(
        `SELECT *
         FROM public.graph_snapshots
         WHERE id = $1
         LIMIT 1`,
        [cleanSnapshotId]
    );
    return mapSnapshot(result.rows[0]);
}


export async function findGraphNodes({ snapshotId, triggerType, triggerValue, limit = 10 }) {
    const cleanValue = sanitizePlainText(triggerValue, 240);
    if (!snapshotId || !cleanValue) return [];
    const lowered = cleanValue.toLowerCase();

    if (triggerType === 'nodeKey') {
        const result = await getDatabasePool().query(
            `SELECT *
             FROM public.graph_nodes
             WHERE snapshot_id = $1 AND lower(node_key) = $2
             LIMIT $3`,
            [snapshotId, lowered, limit]
        );
        return result.rows.map(mapNode);
    }

    if (triggerType === 'sourceFile') {
        const result = await getDatabasePool().query(
            `SELECT *
             FROM public.graph_nodes
             WHERE snapshot_id = $1 AND (lower(source_file) = $2 OR lower(COALESCE(source_file, '')) LIKE $3)
             ORDER BY label ASC
             LIMIT $4`,
            [snapshotId, lowered, `%${lowered}%`, limit]
        );
        return result.rows.map(mapNode);
    }

    const result = await getDatabasePool().query(
        `SELECT *,
            (
                CASE WHEN lower(label) LIKE $2 THEN 2 ELSE 0 END +
                CASE WHEN lower(node_key) LIKE $2 THEN 2 ELSE 0 END +
                CASE WHEN lower(COALESCE(source_file, '')) LIKE $2 THEN 1 ELSE 0 END +
                CASE WHEN lower(COALESCE(summary, '')) LIKE $2 THEN 1 ELSE 0 END
            ) AS rank_score
         FROM public.graph_nodes
         WHERE snapshot_id = $1
           AND (
                lower(label) LIKE $2 OR
                lower(node_key) LIKE $2 OR
                lower(COALESCE(source_file, '')) LIKE $2 OR
                lower(COALESCE(summary, '')) LIKE $2
           )
         ORDER BY rank_score DESC, label ASC
         LIMIT $3`,
        [snapshotId, `%${lowered}%`, limit]
    );
    return result.rows.map(mapNode);
}

export async function loadSnapshotGraph(snapshotId) {
    const [nodesResult, edgesResult] = await Promise.all([
        getDatabasePool().query(`SELECT * FROM public.graph_nodes WHERE snapshot_id = $1`, [snapshotId]),
        getDatabasePool().query(`SELECT * FROM public.graph_edges WHERE snapshot_id = $1`, [snapshotId]),
    ]);

    return {
        nodes: nodesResult.rows.map(mapNode),
        edges: edgesResult.rows.map(mapEdge),
    };
}

export async function searchMemoryItems({
    repoName = AGENT_MEMORY_DEFAULT_REPO,
    query,
    kinds = [],
    limit = 10,
    embedding = null,
}) {
    const cleanRepoName = sanitizePlainText(repoName, 120) || AGENT_MEMORY_DEFAULT_REPO;
    const cleanKinds = Array.isArray(kinds)
        ? kinds.map((kind) => sanitizePlainText(kind, 80)).filter(Boolean)
        : [];

    if (embedding) {
        const params = [cleanRepoName, toVectorLiteral(embedding), limit];
        let kindsClause = '';
        if (cleanKinds.length > 0) {
            params.push(cleanKinds);
            kindsClause = 'AND memory_items.kind = ANY($4::text[])';
        }

        const result = await getDatabasePool().query(
            `SELECT memory_items.*, 1 - (memory_embeddings.embedding <=> $2::extensions.vector) AS similarity
             FROM public.memory_items
             INNER JOIN public.memory_embeddings ON memory_embeddings.memory_item_id = memory_items.id
             WHERE memory_items.repo_name = $1
               ${kindsClause}
             ORDER BY memory_embeddings.embedding <=> $2::extensions.vector ASC, memory_items.updated_at DESC
             LIMIT $3`,
            params
        );
        return result.rows.map((row) => ({ ...mapMemoryItem(row), similarity: Number(row.similarity ?? 0) }));
    }

    const cleanQuery = sanitizePlainText(query, 240);
    if (!cleanQuery) return [];

    const params = [cleanRepoName, cleanQuery, `%${cleanQuery.toLowerCase()}%`, limit];
    let kindsClause = '';
    if (cleanKinds.length > 0) {
        params.push(cleanKinds);
        kindsClause = 'AND kind = ANY($5::text[])';
    }

    const result = await getDatabasePool().query(
        `SELECT *, GREATEST(similarity(title, $2), similarity(content, $2)) AS similarity_score
         FROM public.memory_items
         WHERE repo_name = $1
           AND (
                title % $2 OR
                content % $2 OR
                lower(title) LIKE $3 OR
                lower(content) LIKE $3
           )
           ${kindsClause}
         ORDER BY similarity_score DESC, updated_at DESC
         LIMIT $4`,
        params
    );

    return result.rows.map((row) => ({ ...mapMemoryItem(row), similarity: Number(row.similarity_score ?? 0) }));
}

export async function listMemoryItemsWithoutEmbeddings({
    repoName = AGENT_MEMORY_DEFAULT_REPO,
    kinds = [],
    limit = 20,
}) {
    const cleanRepoName = sanitizePlainText(repoName, 120) || AGENT_MEMORY_DEFAULT_REPO;
    const cleanKinds = Array.isArray(kinds)
        ? kinds.map((kind) => sanitizePlainText(kind, 80)).filter(Boolean)
        : [];
    const params = [cleanRepoName, limit];
    let kindsClause = '';

    if (cleanKinds.length > 0) {
        params.push(cleanKinds);
        kindsClause = 'AND memory_items.kind = ANY($3::text[])';
    }

    const result = await getDatabasePool().query(
        `SELECT memory_items.*
         FROM public.memory_items
         LEFT JOIN public.memory_embeddings
           ON memory_embeddings.memory_item_id = memory_items.id
         WHERE memory_items.repo_name = $1
           AND memory_embeddings.memory_item_id IS NULL
           ${kindsClause}
         ORDER BY memory_items.updated_at DESC
         LIMIT $2`,
        params
    );

    return result.rows.map(mapMemoryItem);
}

export async function countMemoryItemsWithoutEmbeddings({
    repoName = AGENT_MEMORY_DEFAULT_REPO,
    kinds = [],
}) {
    const cleanRepoName = sanitizePlainText(repoName, 120) || AGENT_MEMORY_DEFAULT_REPO;
    const cleanKinds = Array.isArray(kinds)
        ? kinds.map((kind) => sanitizePlainText(kind, 80)).filter(Boolean)
        : [];
    const params = [cleanRepoName];
    let kindsClause = '';

    if (cleanKinds.length > 0) {
        params.push(cleanKinds);
        kindsClause = 'AND memory_items.kind = ANY($2::text[])';
    }

    const result = await getDatabasePool().query(
        `SELECT COUNT(*)::integer AS total
         FROM public.memory_items
         LEFT JOIN public.memory_embeddings
           ON memory_embeddings.memory_item_id = memory_items.id
         WHERE memory_items.repo_name = $1
           AND memory_embeddings.memory_item_id IS NULL
           ${kindsClause}`,
        params
    );

    return Number(result.rows[0]?.total ?? 0);
}

export async function upsertMemoryEmbeddings({
    repoName = AGENT_MEMORY_DEFAULT_REPO,
    items,
}) {
    const cleanRepoName = sanitizePlainText(repoName, 120) || AGENT_MEMORY_DEFAULT_REPO;
    const cleanItems = Array.isArray(items)
        ? items
            .map((item) => ({
                memoryKey: sanitizePlainText(item?.memoryKey, 260),
                model: sanitizePlainText(item?.model, 120) || AGENT_MEMORY_EMBEDDING_MODEL,
                embedding: item?.embedding,
            }))
            .filter((item) => item.memoryKey && Array.isArray(item.embedding))
        : [];

    if (cleanItems.length === 0) {
        return { applied: [], missing: [] };
    }

    return withTransaction(async (client) => {
        const memoryKeys = cleanItems.map((item) => item.memoryKey);
        const itemRows = await client.query(
            `SELECT id, memory_key
             FROM public.memory_items
             WHERE repo_name = $1
               AND memory_key = ANY($2::text[])`,
            [cleanRepoName, memoryKeys]
        );
        const itemIdByKey = new Map(itemRows.rows.map((row) => [row.memory_key, row.id]));
        const applied = [];
        const missing = [];

        for (const item of cleanItems) {
            const memoryItemId = itemIdByKey.get(item.memoryKey);
            if (!memoryItemId) {
                missing.push(item.memoryKey);
                continue;
            }

            await client.query(
                `INSERT INTO public.memory_embeddings (memory_item_id, embedding_model, embedding)
                 VALUES ($1::uuid, $2, $3::extensions.vector)
                 ON CONFLICT (memory_item_id)
                 DO UPDATE SET embedding_model = EXCLUDED.embedding_model, embedding = EXCLUDED.embedding`,
                [memoryItemId, item.model, toVectorLiteral(item.embedding)]
            );

            applied.push({
                memoryKey: item.memoryKey,
                memoryItemId,
                model: item.model,
            });
        }

        return { applied, missing };
    });
}

export async function findRelatedMemoryByNodeRefs({
    repoName = AGENT_MEMORY_DEFAULT_REPO,
    sourceNodeRefs,
    limit = 10,
}) {
    const refs = Array.isArray(sourceNodeRefs)
        ? sourceNodeRefs.map((ref) => sanitizePlainText(ref, 320)).filter(Boolean)
        : [];
    if (refs.length === 0) return [];

    const result = await getDatabasePool().query(
        `SELECT *
         FROM public.memory_items
         WHERE repo_name = $1
           AND source_node_refs && $2::text[]
         ORDER BY updated_at DESC
         LIMIT $3`,
        [sanitizePlainText(repoName, 120) || AGENT_MEMORY_DEFAULT_REPO, refs, limit]
    );
    return result.rows.map(mapMemoryItem);
}

export async function recordImpactAssessment({
    repoName = AGENT_MEMORY_DEFAULT_REPO,
    snapshotId = null,
    triggerType,
    triggerValue,
    directImpact,
    transitiveImpact,
    historicalRisk,
    relatedMemories,
    recommendedTests,
    riskScore,
    notes = null,
    createdBy = null,
}) {
    const result = await getDatabasePool().query(
        `INSERT INTO public.impact_assessments (
            repo_name,
            snapshot_id,
            trigger_type,
            trigger_value,
            direct_impact,
            transitive_impact,
            historical_risk,
            related_memories,
            recommended_tests,
            risk_score,
            notes,
            created_by
        ) VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7::jsonb, $8::jsonb, $9::jsonb, $10, $11, $12)
        RETURNING *`,
        [
            sanitizePlainText(repoName, 120) || AGENT_MEMORY_DEFAULT_REPO,
            snapshotId,
            sanitizePlainText(triggerType, 40),
            sanitizePlainText(triggerValue, 240),
            JSON.stringify(directImpact || []),
            JSON.stringify(transitiveImpact || []),
            JSON.stringify(historicalRisk || []),
            JSON.stringify(relatedMemories || []),
            JSON.stringify(recommendedTests || []),
            Number(riskScore ?? 0),
            sanitizePlainText(notes, 4000) || null,
            sanitizePlainText(createdBy, 120) || null,
        ]
    );

    const row = result.rows[0];
    return {
        id: row.id,
        repoName: row.repo_name,
        snapshotId: row.snapshot_id,
        triggerType: row.trigger_type,
        triggerValue: row.trigger_value,
        directImpact: row.direct_impact || [],
        transitiveImpact: row.transitive_impact || [],
        historicalRisk: row.historical_risk || [],
        relatedMemories: row.related_memories || [],
        recommendedTests: row.recommended_tests || [],
        riskScore: Number(row.risk_score ?? 0),
        notes: row.notes,
        createdBy: row.created_by,
        createdAt: row.created_at,
    };
}

export async function recordFixOutcome({
    assessmentId = null,
    repoName = AGENT_MEMORY_DEFAULT_REPO,
    commitSha = null,
    changedFiles = [],
    testsRun = [],
    failuresFound = [],
    finalResolution,
    createdBy = null,
}) {
    const cleanResolution = sanitizePlainText(finalResolution, 4000);
    if (!cleanResolution) {
        throw new Error('finalResolution is required.');
    }

    const cleanRepoName = sanitizePlainText(repoName, 120) || AGENT_MEMORY_DEFAULT_REPO;
    const cleanCommitSha = sanitizePlainText(commitSha, 120) || null;
    const cleanCreatedBy = sanitizePlainText(createdBy, 120) || null;

    return withTransaction(async (client) => {
        const result = await client.query(
            `INSERT INTO public.fix_outcomes (
                assessment_id,
                repo_name,
                commit_sha,
                changed_files,
                tests_run,
                failures_found,
                final_resolution,
                created_by
            ) VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6::jsonb, $7, $8)
            RETURNING *`,
            [
                assessmentId,
                cleanRepoName,
                cleanCommitSha,
                JSON.stringify(Array.isArray(changedFiles) ? changedFiles : []),
                JSON.stringify(Array.isArray(testsRun) ? testsRun : []),
                JSON.stringify(Array.isArray(failuresFound) ? failuresFound : []),
                cleanResolution,
                cleanCreatedBy,
            ]
        );

        let sourceSnapshotId = null;
        let triggerValue = null;
        if (assessmentId) {
            const assessment = await client.query(
                `SELECT snapshot_id, trigger_value
                 FROM public.impact_assessments
                 WHERE id = $1
                 LIMIT 1`,
                [assessmentId]
            );
            sourceSnapshotId = assessment.rows[0]?.snapshot_id || null;
            triggerValue = assessment.rows[0]?.trigger_value || null;
        }

        await client.query(
            `INSERT INTO public.memory_items (
                repo_name,
                memory_key,
                scope,
                kind,
                title,
                content,
                source_snapshot_id,
                provenance,
                metadata,
                created_by
            ) VALUES ($1, $2, 'fix', 'fixSummary', $3, $4, $5, $6::jsonb, $7::jsonb, $8)
            ON CONFLICT (repo_name, memory_key)
            DO UPDATE SET
                title = EXCLUDED.title,
                content = EXCLUDED.content,
                source_snapshot_id = EXCLUDED.source_snapshot_id,
                provenance = EXCLUDED.provenance,
                metadata = EXCLUDED.metadata,
                created_by = EXCLUDED.created_by`,
            [
                cleanRepoName,
                `fix:${result.rows[0].id}`,
                triggerValue ? `Fix outcome for ${triggerValue}` : 'Fix outcome summary',
                cleanResolution,
                sourceSnapshotId,
                JSON.stringify({
                    assessmentId,
                    commitSha: cleanCommitSha,
                }),
                JSON.stringify({
                    changedFiles: Array.isArray(changedFiles) ? changedFiles : [],
                    testsRun: Array.isArray(testsRun) ? testsRun : [],
                    failuresFound: Array.isArray(failuresFound) ? failuresFound : [],
                }),
                cleanCreatedBy,
            ]
        );

        const row = result.rows[0];
        return {
            id: row.id,
            assessmentId: row.assessment_id,
            repoName: row.repo_name,
            commitSha: row.commit_sha,
            changedFiles: row.changed_files || [],
            testsRun: row.tests_run || [],
            failuresFound: row.failures_found || [],
            finalResolution: row.final_resolution,
            createdBy: row.created_by,
            createdAt: row.created_at,
        };
    });
}
