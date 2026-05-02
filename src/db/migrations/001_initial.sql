-- =============================================================================
-- Migration 001: Initial schema — Cognigy OData Suite
-- Run once per customer database on first connection.
-- All entity tables use CREATE TABLE IF NOT EXISTS for idempotent re-runs.
-- =============================================================================

-- =============================================================================
-- IMPORT TRACKING
-- =============================================================================

CREATE TABLE IF NOT EXISTS import_jobs (
    id               VARCHAR      PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_name      VARCHAR      NOT NULL,
    started_at       TIMESTAMPTZ  NOT NULL DEFAULT current_timestamp,
    completed_at     TIMESTAMPTZ,
    records_added    INTEGER      NOT NULL DEFAULT 0,
    records_updated  INTEGER      NOT NULL DEFAULT 0,
    records_skipped  INTEGER      NOT NULL DEFAULT 0,
    total_fetched    INTEGER      NOT NULL DEFAULT 0,
    status           VARCHAR      NOT NULL DEFAULT 'pending',  -- pending|running|success|failed
    error_message    VARCHAR
);

CREATE INDEX IF NOT EXISTS idx_import_jobs_entity_started
    ON import_jobs (entity_name, started_at);

-- Tracks the high-water mark per entity for incremental (timestamp-based) sync.
-- Entities without a timestamp field (steps, goal_steps, goal_step_metrics)
-- use sync_mode='full_refresh' and leave sync_field empty.
CREATE TABLE IF NOT EXISTS import_state (
    entity_name             VARCHAR     PRIMARY KEY,
    last_imported_at        TIMESTAMPTZ,
    sync_field              VARCHAR     NOT NULL DEFAULT 'timestamp',
    sync_mode               VARCHAR     NOT NULL DEFAULT 'incremental',  -- incremental|full_refresh
    last_successful_job_id  VARCHAR,
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT current_timestamp
);

INSERT INTO import_state (entity_name, sync_field, sync_mode) VALUES
    ('analytics',              'timestamp',   'incremental'),
    ('conversations',          'timestamp',   'incremental'),
    ('steps',                  '',            'full_refresh'),
    ('executed_steps',         'timestamp',   'incremental'),
    ('sessions',               'startedAt',   'incremental'),
    ('live_agent_escalations', 'timestamp',   'incremental'),
    ('goals',                  'lastChanged', 'incremental'),
    ('goal_steps',             '',            'full_refresh'),
    ('goal_step_metrics',      '',            'full_refresh'),
    ('goal_events',            'timestamp',   'incremental')
ON CONFLICT (entity_name) DO NOTHING;

-- =============================================================================
-- ANALYTICS
-- Comprehensive interaction logs. inputText/inputData may be NULL (Blind Mode).
-- custom1–custom10 are user-defined fields capped at 512 chars in the API.
-- completedGoalsList, foundSlots, foundSlotDetails arrive as JSON strings.
-- =============================================================================

CREATE TABLE IF NOT EXISTS analytics (
    id                  VARCHAR     PRIMARY KEY,
    _id                 VARCHAR,
    organisation        VARCHAR,
    projectId           VARCHAR,
    flowReferenceId     VARCHAR,
    entrypoint          VARCHAR,
    ip                  VARCHAR,
    contactId           VARCHAR,
    sessionId           VARCHAR,
    inputId             VARCHAR,
    inputText           VARCHAR,        -- nullable: masked in Blind Mode
    inputData           VARCHAR,        -- nullable: masked in Blind Mode
    state               VARCHAR,
    mode                VARCHAR,
    userType            VARCHAR,
    channel             VARCHAR,
    flowLanguage        VARCHAR,
    intent              VARCHAR,
    intentFlow          VARCHAR,
    intentScore         DOUBLE,
    completedGoalsList  VARCHAR,        -- JSON string
    foundSlots          VARCHAR,        -- JSON string
    foundSlotDetails    VARCHAR,        -- JSON string
    timestamp           TIMESTAMPTZ,
    executionTime       DOUBLE,
    execution           DOUBLE,
    custom1             VARCHAR,
    custom2             VARCHAR,
    custom3             VARCHAR,
    custom4             VARCHAR,
    custom5             VARCHAR,
    custom6             VARCHAR,
    custom7             VARCHAR,
    custom8             VARCHAR,
    custom9             VARCHAR,
    custom10            VARCHAR,
    localeReferenceId   VARCHAR,
    localeName          VARCHAR,
    endpointUrlToken    VARCHAR,
    endpointName        VARCHAR,
    rating              SMALLINT,
    ratingComment       VARCHAR,
    snapshotName        VARCHAR,
    _imported_at        TIMESTAMPTZ NOT NULL DEFAULT current_timestamp
);

CREATE INDEX IF NOT EXISTS idx_analytics_sessionId  ON analytics (sessionId);
CREATE INDEX IF NOT EXISTS idx_analytics_projectId  ON analytics (projectId);
CREATE INDEX IF NOT EXISTS idx_analytics_timestamp  ON analytics (timestamp);
CREATE INDEX IF NOT EXISTS idx_analytics_intent     ON analytics (intent);
CREATE INDEX IF NOT EXISTS idx_analytics_contactId  ON analytics (contactId);

-- =============================================================================
-- CONVERSATIONS
-- Full message history (user, bot, agent turns).
-- inputText/inputData nullable. inputAttachments stored as JSON string.
-- =============================================================================

CREATE TABLE IF NOT EXISTS conversations (
    id                     VARCHAR     PRIMARY KEY,
    _id                    VARCHAR,
    projectId              VARCHAR,
    projectName            VARCHAR,
    inputId                VARCHAR,
    sessionId              VARCHAR,
    contactId              VARCHAR,
    organisation           VARCHAR,
    inputText              VARCHAR,    -- nullable: masked in Blind Mode
    inputData              VARCHAR,    -- nullable: masked in Blind Mode
    type                   VARCHAR,
    source                 VARCHAR,
    timestamp              TIMESTAMPTZ,
    flowName               VARCHAR,
    flowParentId           VARCHAR,
    channel                VARCHAR,
    inHandoverRequest      BOOLEAN,
    inHandoverConversation BOOLEAN,
    outputId               VARCHAR,
    inputAttachments       VARCHAR,    -- JSON string
    reference              VARCHAR,
    localeReferenceId      VARCHAR,
    endpointUrlToken       VARCHAR,
    endpointName           VARCHAR,
    snapshotId             VARCHAR,
    snapshotName           VARCHAR,
    rating                 SMALLINT,
    ratingComment          VARCHAR,
    _imported_at           TIMESTAMPTZ NOT NULL DEFAULT current_timestamp
);

CREATE INDEX IF NOT EXISTS idx_conversations_sessionId ON conversations (sessionId);
CREATE INDEX IF NOT EXISTS idx_conversations_projectId ON conversations (projectId);
CREATE INDEX IF NOT EXISTS idx_conversations_timestamp ON conversations (timestamp);
CREATE INDEX IF NOT EXISTS idx_conversations_contactId ON conversations (contactId);

-- =============================================================================
-- STEPS
-- Static configuration entities (analytics checkpoints / nodes).
-- No timestamp field — always full_refresh.
-- =============================================================================

CREATE TABLE IF NOT EXISTS steps (
    id                VARCHAR     PRIMARY KEY,
    _id               VARCHAR,
    label             VARCHAR,
    type              VARCHAR,
    entityReferenceId VARCHAR,
    flowReferenceId   VARCHAR,
    flowName          VARCHAR,
    projectName       VARCHAR,
    snapshotId        VARCHAR,
    snapshotName      VARCHAR,
    _imported_at      TIMESTAMPTZ NOT NULL DEFAULT current_timestamp
);

CREATE INDEX IF NOT EXISTS idx_steps_flowReferenceId ON steps (flowReferenceId);

-- =============================================================================
-- EXECUTED STEPS
-- Runtime step executions. parentStep links back to the triggering step id.
-- =============================================================================

CREATE TABLE IF NOT EXISTS executed_steps (
    id                VARCHAR     PRIMARY KEY,
    _id               VARCHAR,
    userId            VARCHAR,
    sessionId         VARCHAR,
    inputId           VARCHAR,
    stepLabel         VARCHAR,
    parentStep        VARCHAR,
    type              VARCHAR,
    entityReferenceId VARCHAR,
    flowReferenceId   VARCHAR,
    flowName          VARCHAR,
    timestamp         TIMESTAMPTZ,
    projectName       VARCHAR,
    projectId         VARCHAR,
    organisationId    VARCHAR,
    snapshotId        VARCHAR,
    snapshotName      VARCHAR,
    localeReferenceId VARCHAR,
    localeName        VARCHAR,
    endpointUrlToken  VARCHAR,
    endpointName      VARCHAR,
    _imported_at      TIMESTAMPTZ NOT NULL DEFAULT current_timestamp
);

CREATE INDEX IF NOT EXISTS idx_executed_steps_sessionId ON executed_steps (sessionId);
CREATE INDEX IF NOT EXISTS idx_executed_steps_projectId ON executed_steps (projectId);
CREATE INDEX IF NOT EXISTS idx_executed_steps_timestamp ON executed_steps (timestamp);

-- =============================================================================
-- SESSIONS
-- Session summaries. goals and stepPath arrive as JSON strings.
-- Note: both id (PK) and sessionId are present — they may differ in some flows.
-- =============================================================================

CREATE TABLE IF NOT EXISTS sessions (
    id                  VARCHAR     PRIMARY KEY,
    _id                 VARCHAR,
    goals               VARCHAR,        -- JSON string
    stepPath            VARCHAR,        -- JSON string
    stepsCount          INTEGER,
    handoverEscalations INTEGER,
    startedAt           TIMESTAMPTZ,
    userId              VARCHAR,
    sessionId           VARCHAR,
    localeReferenceId   VARCHAR,
    localeName          VARCHAR,
    endpointReferenceId VARCHAR,
    endpointName        VARCHAR,
    projectName         VARCHAR,
    projectId           VARCHAR,
    organisationId      VARCHAR,
    snapshotId          VARCHAR,
    snapshotName        VARCHAR,
    endpointUrlToken    VARCHAR,
    rating              SMALLINT,
    ratingComment       VARCHAR,
    _imported_at        TIMESTAMPTZ NOT NULL DEFAULT current_timestamp
);

CREATE INDEX IF NOT EXISTS idx_sessions_sessionId ON sessions (sessionId);
CREATE INDEX IF NOT EXISTS idx_sessions_projectId ON sessions (projectId);
CREATE INDEX IF NOT EXISTS idx_sessions_startedAt ON sessions (startedAt);
CREATE INDEX IF NOT EXISTS idx_sessions_userId    ON sessions (userId);

-- =============================================================================
-- LIVE AGENT ESCALATIONS
-- Handover events to Live Agent. labels arrives as a JSON array string.
-- =============================================================================

CREATE TABLE IF NOT EXISTS live_agent_escalations (
    id                VARCHAR     PRIMARY KEY,
    _id               VARCHAR,
    organisationId    VARCHAR,
    projectId         VARCHAR,
    sessionId         VARCHAR,
    timestamp         TIMESTAMPTZ,
    localeName        VARCHAR,
    status            VARCHAR,
    inboxId           VARCHAR,
    inboxName         VARCHAR,
    teamId            VARCHAR,
    teamName          VARCHAR,
    labels            VARCHAR,    -- JSON array string
    agentId           VARCHAR,
    agentName         VARCHAR,
    contactId         VARCHAR,
    endpointName      VARCHAR,
    endpointType      VARCHAR,
    endpointUrlToken  VARCHAR,
    channel           VARCHAR,
    localeReferenceId VARCHAR,
    snapshotId        VARCHAR,
    snapshotName      VARCHAR,
    _imported_at      TIMESTAMPTZ NOT NULL DEFAULT current_timestamp
);

CREATE INDEX IF NOT EXISTS idx_escalations_sessionId ON live_agent_escalations (sessionId);
CREATE INDEX IF NOT EXISTS idx_escalations_projectId ON live_agent_escalations (projectId);
CREATE INDEX IF NOT EXISTS idx_escalations_timestamp ON live_agent_escalations (timestamp);

-- =============================================================================
-- GOALS
-- Goal definitions. Incremental sync via lastChanged.
-- =============================================================================

CREATE TABLE IF NOT EXISTS goals (
    goalId         VARCHAR     PRIMARY KEY,
    name           VARCHAR,
    version        VARCHAR,
    description    VARCHAR,
    referenceId    VARCHAR,
    projectId      VARCHAR,
    organisationId VARCHAR,
    createdAt      TIMESTAMPTZ,
    lastChanged    TIMESTAMPTZ,
    createdBy      VARCHAR,
    lastChangedBy  VARCHAR,
    _imported_at   TIMESTAMPTZ NOT NULL DEFAULT current_timestamp
);

CREATE INDEX IF NOT EXISTS idx_goals_projectId ON goals (projectId);

-- =============================================================================
-- GOAL STEPS
-- Individual stages within a goal. No timestamp — full_refresh.
-- "order" is quoted: reserved word in SQL.
-- =============================================================================

CREATE TABLE IF NOT EXISTS goal_steps (
    goalStepId     VARCHAR     PRIMARY KEY,
    name           VARCHAR,
    version        VARCHAR,
    description    VARCHAR,
    "order"        INTEGER,
    text           VARCHAR,
    type           VARCHAR,
    goalId         VARCHAR,
    projectId      VARCHAR,
    organisationId VARCHAR,
    _imported_at   TIMESTAMPTZ NOT NULL DEFAULT current_timestamp
);

CREATE INDEX IF NOT EXISTS idx_goal_steps_goalId    ON goal_steps (goalId);
CREATE INDEX IF NOT EXISTS idx_goal_steps_projectId ON goal_steps (projectId);

-- =============================================================================
-- GOAL STEP METRICS
-- Measurements attached to a goal step (duration, currency, etc.).
-- No timestamp — full_refresh.
-- =============================================================================

CREATE TABLE IF NOT EXISTS goal_step_metrics (
    goalStepMetricId VARCHAR     PRIMARY KEY,
    name             VARCHAR,
    version          VARCHAR,
    description      VARCHAR,
    type             VARCHAR,
    value            INTEGER,
    goalId           VARCHAR,
    goalStepId       VARCHAR,
    projectId        VARCHAR,
    organisationId   VARCHAR,
    _imported_at     TIMESTAMPTZ NOT NULL DEFAULT current_timestamp
);

CREATE INDEX IF NOT EXISTS idx_goal_step_metrics_goalId     ON goal_step_metrics (goalId);
CREATE INDEX IF NOT EXISTS idx_goal_step_metrics_goalStepId ON goal_step_metrics (goalStepId);
CREATE INDEX IF NOT EXISTS idx_goal_step_metrics_projectId  ON goal_step_metrics (projectId);

-- =============================================================================
-- GOAL EVENTS
-- Timestamped occurrences within a goal cycle.
-- =============================================================================

CREATE TABLE IF NOT EXISTS goal_events (
    id                VARCHAR     PRIMARY KEY,
    version           VARCHAR,
    timestamp         TIMESTAMPTZ,
    goalCycleId       VARCHAR,
    stepId            VARCHAR,
    goalId            VARCHAR,
    sessionId         VARCHAR,
    projectId         VARCHAR,
    organisationId    VARCHAR,
    expiresAt         TIMESTAMPTZ,
    localeName        VARCHAR,
    endpointName      VARCHAR,
    endpointType      VARCHAR,
    endpointUrlToken  VARCHAR,
    channel           VARCHAR,
    localeReferenceId VARCHAR,
    snapshotId        VARCHAR,
    snapshotName      VARCHAR,
    _imported_at      TIMESTAMPTZ NOT NULL DEFAULT current_timestamp
);

CREATE INDEX IF NOT EXISTS idx_goal_events_sessionId ON goal_events (sessionId);
CREATE INDEX IF NOT EXISTS idx_goal_events_goalId    ON goal_events (goalId);
CREATE INDEX IF NOT EXISTS idx_goal_events_projectId ON goal_events (projectId);
CREATE INDEX IF NOT EXISTS idx_goal_events_timestamp ON goal_events (timestamp);
