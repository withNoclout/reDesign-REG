/**
 * @fileoverview Shared JSDoc type definitions for the REG KMUTNB web application.
 * 
 * ══════════════════════════════════════════════════════════════════════
 * BOUNDARY RULE:
 *   - Database (Supabase)  → snake_case  (student_id, current_year)
 *   - lib/ layer           → Adapter (translates between the two)
 *   - API Responses        → camelCase  (studentId, currentYear)
 *   - React Components     → camelCase  (studentId, currentYear)
 * ══════════════════════════════════════════════════════════════════════
 * 
 * This file contains NO runtime code. It is only for type-checking and
 * IntelliSense/autocomplete in editors like VS Code.
 */

// ─────────────────────────────────────────────────────────────
//  PROFILE
// ─────────────────────────────────────────────────────────────

/**
 * A student's academic profile, as used across the JavaScript layer.
 * All fields are camelCase. DB stores these as snake_case.
 * 
 * @typedef {Object} StudentProfile
 * @property {string} studentId         - Unique student code e.g. "s6701091611290"
 * @property {string|null} faculty      - Faculty name in Thai
 * @property {string|null} department   - Department or ภาควิชา
 * @property {string|null} major        - Curriculum / หลักสูตร
 * @property {string|null} advisor1     - Primary advisor name
 * @property {string|null} advisor2     - Secondary advisor name (if any)
 * @property {string|null} advisor3     - Third advisor name (if any)
 * @property {number|null} admitYear    - BE year student was admitted
 * @property {number|null} currentYear  - Current academic year (BE)
 * @property {number|null} currentSemester - Current semester (1, 2, or 3)
 * @property {number|null} enrollYear   - Enrollment academic year
 * @property {number|null} enrollSemester - Enrollment semester
 * @property {string|null} avatarUrl    - Public URL from Supabase Storage bucket 'avatars'
 */

// ─────────────────────────────────────────────────────────────
//  API RESPONSES
// ─────────────────────────────────────────────────────────────

/**
 * Standard API success response wrapper.
 * @template T
 * @typedef {Object} ApiSuccessResponse
 * @property {true}  success
 * @property {T}     data
 */

/**
 * Standard API error response wrapper.
 * @typedef {Object} ApiErrorResponse
 * @property {false} success
 * @property {{ message: string, code?: string }} error
 */

// ─────────────────────────────────────────────────────────────
//  AUTH
// ─────────────────────────────────────────────────────────────

/**
 * The user object stored in React AuthContext after login.
 * 
 * @typedef {Object} AuthUser
 * @property {string} usercode       - Student code e.g. "s6701091611290"
 * @property {string} username       - Full name in Thai
 * @property {string} usernameeng    - Full name in English
 * @property {string} name           - Display name (Thai)
 * @property {string} nameeng        - Display name (English)
 * @property {string} email          - University email
 * @property {string} userstatus     - 'Y' = active, else inactive
 * @property {string} userstatusdes  - Thai description of status
 * @property {string[]} role         - Array of roles, e.g. ['student']
 * @property {string} img            - Profile image URL (custom or from university)
 * @property {string} originalImg    - Original university profile image URL
 * @property {string} reportdate     - Date of registration record
 */

/**
 * Normalized KMUTNB SSO user information returned by the backend helper layer.
 *
 * @typedef {Object} KmutnbSsoUser
 * @property {string} subject               - Stable SSO subject identifier (`sub`)
 * @property {string|null} username         - Preferred username from SSO
 * @property {string|null} displayName      - Display name from SSO
 * @property {string|null} nameEn           - English display name if available
 * @property {string|null} email            - KMUTNB email address
 * @property {boolean} emailVerified        - Whether the email is verified by SSO
 * @property {string|null} accountType      - Account type such as `student` or `personnel`
 * @property {string|null} userCode         - Normalized student code without `s` prefix when available
 * @property {Object|null} studentInfo      - Raw `student_info` claim subset
 * @property {Object|null} personnelInfo    - Raw `personnel_info` claim subset
 * @property {Object} raw                   - Full original userinfo payload
 */

/**
 * Persistent backend session state for a KMUTNB SSO login.
 *
 * @typedef {Object} KmutnbSsoSession
 * @property {string} sessionId             - Opaque server-side session identifier
 * @property {string} provider              - Provider key (`kmutnb_sso`)
 * @property {string} subject               - Stable SSO subject identifier (`sub`)
 * @property {string|null} userCode         - Normalized student code when available
 * @property {string} accessToken           - Current OAuth access token
 * @property {string|null} refreshToken     - OAuth refresh token, if granted
 * @property {string|null} idToken          - OpenID Connect ID token, if granted
 * @property {string} scope                 - Granted scope list
 * @property {string} tokenType             - Usually `Bearer`
 * @property {string|null} accessTokenExpiresAt - ISO timestamp for access-token expiry
 * @property {Object} userInfo              - Raw userinfo payload stored server-side
 * @property {string|null} lastRefreshedAt  - ISO timestamp of the most recent refresh
 * @property {string} createdAt             - ISO timestamp when the session was created
 * @property {string} updatedAt             - ISO timestamp when the session was updated
 * @property {string|null} revokedAt        - ISO timestamp when the session was revoked
 */

// ─────────────────────────────────────────────────────────────
//  PORTFOLIO
// ─────────────────────────────────────────────────────────────

/**
 * A portfolio item stored in Supabase.
 * 
 * @typedef {Object} PortfolioItem
 * @property {string}   id           - UUID from Supabase
 * @property {string}   studentId    - Owner's student code
 * @property {string}   title        - Project title
 * @property {string}   description  - Description text
 * @property {string|null} imageUrl  - Public URL from Supabase Storage bucket 'portfolios'
 * @property {string}   createdAt    - ISO timestamp
 * @property {string}   updatedAt    - ISO timestamp
 */

// ─────────────────────────────────────────────────────────────
//  AGENT MEMORY
// ─────────────────────────────────────────────────────────────

/**
 * A persisted graph snapshot imported from graphify for agent analysis.
 *
 * @typedef {Object} GraphSnapshot
 * @property {string} id
 * @property {string} repoName
 * @property {string|null} branchName
 * @property {string} commitSha
 * @property {string} graphVersion
 * @property {string[]} sourceScope
 * @property {string|null} graphJsonPath
 * @property {string|null} reportPath
 * @property {'pending'|'ready'|'failed'} status
 * @property {{ nodeCount?: number, edgeCount?: number, hyperedgeCount?: number, memoryItemCount?: number }} graphStats
 * @property {string|null} createdBy
 * @property {string} createdAt
 * @property {string} updatedAt
 */

/**
 * A normalized graph node stored for agent memory traversal.
 *
 * @typedef {Object} GraphNode
 * @property {string} nodeRef
 * @property {string} snapshotId
 * @property {string} nodeKey
 * @property {string} label
 * @property {string} nodeType
 * @property {string|null} fileType
 * @property {string|null} sourceFile
 * @property {string|null} sourceLocation
 * @property {string|null} summary
 * @property {Record<string, any>} metadata
 */

/**
 * A normalized graph edge stored for impact analysis.
 *
 * @typedef {Object} GraphEdge
 * @property {string} id
 * @property {string} snapshotId
 * @property {string} sourceNodeRef
 * @property {string} targetNodeRef
 * @property {string} relation
 * @property {'EXTRACTED'|'INFERRED'|'AMBIGUOUS'} confidence
 * @property {number} confidenceScore
 * @property {string|null} sourceFile
 * @property {number} weight
 * @property {Record<string, any>} metadata
 */

/**
 * A long-lived agent memory record, optionally tied back to graph nodes.
 *
 * @typedef {Object} MemoryItem
 * @property {string} id
 * @property {string} repoName
 * @property {string} memoryKey
 * @property {'repo'|'subsystem'|'node'|'fix'|'incident'|'release'} scope
 * @property {string} kind
 * @property {string} title
 * @property {string} content
 * @property {string|null} sourceSnapshotId
 * @property {string[]} sourceNodeRefs
 * @property {Record<string, any>} provenance
 * @property {Record<string, any>} metadata
 * @property {string|null} createdBy
 * @property {string} createdAt
 * @property {string} updatedAt
 * @property {string|null} expiresAt
 */

/**
 * The result of an agent impact analysis for a surgical fix candidate.
 *
 * @typedef {Object} ImpactAssessment
 * @property {string} id
 * @property {string} repoName
 * @property {string|null} snapshotId
 * @property {string} triggerType
 * @property {string} triggerValue
 * @property {Array<Record<string, any>>} directImpact
 * @property {Array<Record<string, any>>} transitiveImpact
 * @property {Array<Record<string, any>>} historicalRisk
 * @property {Array<Record<string, any>>} relatedMemories
 * @property {string[]} recommendedTests
 * @property {number} riskScore
 * @property {string|null} notes
 * @property {string|null} createdBy
 * @property {string} createdAt
 */

/**
 * Manual borrower profile chosen by the student for Student Loan scheduling.
 *
 * @typedef {Object} StudentLoanBorrowerProfile
 * @property {'new'|'continuing'} borrowerType
 * @property {'vocational'|'bachelor'} educationLevel
 * @property {'manual'|'recommended'} source
 * @property {string} confirmedAt
 * @property {string} updatedAt
 */

/**
 * Recommended borrower profile inferred from academic data before user confirmation.
 *
 * @typedef {Object} StudentLoanBorrowerRecommendation
 * @property {'new'|'continuing'} borrowerType
 * @property {'vocational'|'bachelor'} educationLevel
 * @property {'high'|'medium'} confidence
 * @property {number|null} estimatedCompletedSemesters
 * @property {string} reason
 */

/**
 * A normalized Student Loan schedule event sourced from Student Affairs pages.
 *
 * @typedef {Object} StudentLoanEvent
 * @property {string} id
 * @property {'new'|'continuing'} audience
 * @property {'vocational'|'bachelor'} educationLevel
 * @property {string} stage
 * @property {'open'|'closingSoon'} phase
 * @property {string} title
 * @property {string} message
 * @property {string} href
 * @property {string} ctaLabel
 * @property {string} opensAt
 * @property {string} closesAt
 * @property {string} reminderAt
 * @property {string} sourceId
 */

/**
 * A normalized Student Loan quick link.
 *
 * @typedef {Object} StudentLoanResource
 * @property {string} id
 * @property {string} title
 * @property {string} href
 * @property {'form'|'portal'|'article'|'guide'} kind
 * @property {'new'|'continuing'} audience
 * @property {'vocational'|'bachelor'|'all'} educationLevel
 * @property {string} description
 */

/**
 * A normalized Student Loan process step sourced from new-borrower guides.
 *
 * @typedef {Object} StudentLoanStep
 * @property {string} id
 * @property {string} title
 * @property {string} href
 * @property {string} stage
 * @property {'new'|'continuing'} audience
 * @property {'vocational'|'bachelor'|'all'} educationLevel
 * @property {'pendingAnnouncement'|'scheduled'|'published'} status
 * @property {string} summary
 * @property {string} modifiedAt
 * @property {{ opensAt: string, closesAt: string } | null} [schedule]
 */

/**
 * A normalized Google Classroom notification mirrored into the local product.
 *
 * @typedef {Object} GoogleClassroomNotification
 * @property {string} id
 * @property {'announcement'|'courseWork'|'studentSubmission'} sourceType
 * @property {string} eventType
 * @property {string} courseId
 * @property {string|null} courseName
 * @property {string|null} announcementId
 * @property {string|null} courseWorkId
 * @property {string|null} studentSubmissionId
 * @property {string} href
 * @property {string} title
 * @property {string} message
 * @property {string} sortAt
 * @property {string} resourceUpdatedAt
 * @property {string|null} seenAt
 * @property {Record<string, any>} payload
 * @property {string} createdAt
 * @property {string} updatedAt
 */

/**
 * The current Google Classroom notification connection and unread state for a user.
 *
 * @typedef {Object} GoogleClassroomNotificationFeed
 * @property {boolean} configured
 * @property {boolean} connected
 * @property {boolean} reconnectRequired
 * @property {boolean} authRequired
 * @property {string|null} userCode
 * @property {Array<Object>} notifications
 * @property {number} unreadCount
 * @property {string|null} lastSyncedAt
 * @property {string|null} lastSyncError
 */

/**
 * A normalized LINE Messaging account known to the product.
 *
 * @typedef {Object} LineMessagingAccount
 * @property {string} lineUserId
 * @property {string|null} userCode
 * @property {string|null} displayName
 * @property {string|null} pictureUrl
 * @property {string|null} language
 * @property {string|null} statusMessage
 * @property {'following'|'unfollowed'} friendshipStatus
 * @property {'linked'|'unlinked'} linkStatus
 * @property {string|null} lastFollowedAt
 * @property {string|null} lastUnfollowedAt
 * @property {string|null} lastLinkedAt
 * @property {string|null} lastUnlinkedAt
 * @property {string|null} lastWebhookAt
 * @property {string|null} lastMessageAt
 * @property {string} createdAt
 * @property {string} updatedAt
 */

/**
 * A pending or completed LINE account-link handshake initiated from the web product.
 *
 * @typedef {Object} LineLinkRequest
 * @property {string} nonce
 * @property {string} userCode
 * @property {string|null} lineUserId
 * @property {'pending'|'linked'|'failed'|'expired'} status
 * @property {string} expiresAt
 * @property {string|null} linkedAt
 * @property {string|null} failedAt
 * @property {string} createdAt
 * @property {string} updatedAt
 */

/**
 * Audit record for a webhook event received from LINE Messaging API.
 *
 * @typedef {Object} LineWebhookEventReceipt
 * @property {string} webhookEventId
 * @property {string} eventType
 * @property {string|null} lineUserId
 * @property {string|null} groupId
 * @property {string|null} roomId
 * @property {'processed'|'ignored'|'failed'} status
 * @property {boolean} isRedelivery
 * @property {string|null} occurredAt
 * @property {string|null} processedAt
 * @property {string|null} errorMessage
 * @property {Record<string, any>} payload
 */

export { }; // Make this a module (required for JSDoc to work correctly in some configs)
