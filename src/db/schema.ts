// TypeScript interfaces mirroring all DuckDB table schemas.
// DuckDB Node.js driver returns TIMESTAMPTZ as Date, VARCHAR as string,
// DOUBLE/INTEGER/SMALLINT as number, BOOLEAN as boolean.
// All OData fields are nullable (API may omit any field); PKs and _imported_at are not.

export type ImportStatus = 'pending' | 'running' | 'success' | 'failed'
export type SyncMode = 'incremental' | 'full_refresh'

export type EntityName =
  | 'analytics'
  | 'conversations'
  | 'steps'
  | 'executed_steps'
  | 'sessions'
  | 'live_agent_escalations'
  | 'goals'
  | 'goal_steps'
  | 'goal_step_metrics'
  | 'goal_events'

// =============================================================================
// IMPORT TRACKING
// =============================================================================

export interface ImportJob {
  id: string
  entity_name: EntityName
  started_at: Date
  completed_at: Date | null
  records_added: number
  records_updated: number
  records_skipped: number
  total_fetched: number
  status: ImportStatus
  error_message: string | null
}

export interface ImportState {
  entity_name: EntityName
  last_imported_at: Date | null
  sync_field: string
  sync_mode: SyncMode
  last_successful_job_id: string | null
  updated_at: Date
}

// =============================================================================
// ENTITY INTERFACES
// =============================================================================

export interface Analytics {
  id: string
  _id: string | null
  organisation: string | null
  projectId: string | null
  flowReferenceId: string | null
  entrypoint: string | null
  ip: string | null
  contactId: string | null
  sessionId: string | null
  inputId: string | null
  inputText: string | null       // null when Blind Mode / masking active
  inputData: string | null       // null when Blind Mode / masking active
  state: string | null
  mode: string | null
  userType: string | null
  channel: string | null
  flowLanguage: string | null
  intent: string | null
  intentFlow: string | null
  intentScore: number | null
  completedGoalsList: string | null  // JSON string — parse with JSON.parse()
  foundSlots: string | null          // JSON string
  foundSlotDetails: string | null    // JSON string
  timestamp: Date | null
  executionTime: number | null
  execution: number | null
  custom1: string | null
  custom2: string | null
  custom3: string | null
  custom4: string | null
  custom5: string | null
  custom6: string | null
  custom7: string | null
  custom8: string | null
  custom9: string | null
  custom10: string | null
  localeReferenceId: string | null
  localeName: string | null
  endpointUrlToken: string | null
  endpointName: string | null
  rating: number | null
  ratingComment: string | null
  snapshotName: string | null
  _imported_at: Date
}

export interface Conversation {
  id: string
  _id: string | null
  projectId: string | null
  projectName: string | null
  inputId: string | null
  sessionId: string | null
  contactId: string | null
  organisation: string | null
  inputText: string | null       // null when Blind Mode / masking active
  inputData: string | null       // null when Blind Mode / masking active
  type: string | null
  source: string | null
  timestamp: Date | null
  flowName: string | null
  flowParentId: string | null
  channel: string | null
  inHandoverRequest: boolean | null
  inHandoverConversation: boolean | null
  outputId: string | null
  inputAttachments: string | null  // JSON string
  reference: string | null
  localeReferenceId: string | null
  endpointUrlToken: string | null
  endpointName: string | null
  snapshotId: string | null
  snapshotName: string | null
  rating: number | null
  ratingComment: string | null
  _imported_at: Date
}

export interface Step {
  id: string
  _id: string | null
  label: string | null
  type: string | null
  entityReferenceId: string | null
  flowReferenceId: string | null
  flowName: string | null
  projectName: string | null
  snapshotId: string | null
  snapshotName: string | null
  _imported_at: Date
}

export interface ExecutedStep {
  id: string
  _id: string | null
  userId: string | null
  sessionId: string | null
  inputId: string | null
  stepLabel: string | null
  parentStep: string | null
  type: string | null
  entityReferenceId: string | null
  flowReferenceId: string | null
  flowName: string | null
  timestamp: Date | null
  projectName: string | null
  projectId: string | null
  organisationId: string | null
  snapshotId: string | null
  snapshotName: string | null
  localeReferenceId: string | null
  localeName: string | null
  endpointUrlToken: string | null
  endpointName: string | null
  _imported_at: Date
}

export interface Session {
  id: string
  _id: string | null
  goals: string | null       // JSON string
  stepPath: string | null    // JSON string
  stepsCount: number | null
  handoverEscalations: number | null
  startedAt: Date | null
  userId: string | null
  sessionId: string | null
  localeReferenceId: string | null
  localeName: string | null
  endpointReferenceId: string | null
  endpointName: string | null
  projectName: string | null
  projectId: string | null
  organisationId: string | null
  snapshotId: string | null
  snapshotName: string | null
  endpointUrlToken: string | null
  rating: number | null
  ratingComment: string | null
  _imported_at: Date
}

export interface LiveAgentEscalation {
  id: string
  _id: string | null
  organisationId: string | null
  projectId: string | null
  sessionId: string | null
  timestamp: Date | null
  localeName: string | null
  status: string | null
  inboxId: string | null
  inboxName: string | null
  teamId: string | null
  teamName: string | null
  labels: string | null    // JSON array string
  agentId: string | null
  agentName: string | null
  contactId: string | null
  endpointName: string | null
  endpointType: string | null
  endpointUrlToken: string | null
  channel: string | null
  localeReferenceId: string | null
  snapshotId: string | null
  snapshotName: string | null
  _imported_at: Date
}

export interface Goal {
  goalId: string
  name: string | null
  version: string | null
  description: string | null
  referenceId: string | null
  projectId: string | null
  organisationId: string | null
  createdAt: Date | null
  lastChanged: Date | null
  createdBy: string | null
  lastChangedBy: string | null
  _imported_at: Date
}

export interface GoalStep {
  goalStepId: string
  name: string | null
  version: string | null
  description: string | null
  order: number | null
  text: string | null
  type: string | null
  goalId: string | null
  projectId: string | null
  organisationId: string | null
  _imported_at: Date
}

export interface GoalStepMetric {
  goalStepMetricId: string
  name: string | null
  version: string | null
  description: string | null
  type: string | null
  value: number | null
  goalId: string | null
  goalStepId: string | null
  projectId: string | null
  organisationId: string | null
  _imported_at: Date
}

export interface GoalEvent {
  id: string
  version: string | null
  timestamp: Date | null
  goalCycleId: string | null
  stepId: string | null
  goalId: string | null
  sessionId: string | null
  projectId: string | null
  organisationId: string | null
  expiresAt: Date | null
  localeName: string | null
  endpointName: string | null
  endpointType: string | null
  endpointUrlToken: string | null
  channel: string | null
  localeReferenceId: string | null
  snapshotId: string | null
  snapshotName: string | null
  _imported_at: Date
}

// =============================================================================
// ENTITY CONFIGURATION
// Drives the import engine: maps entity names → OData collection, PK, sync strategy.
// =============================================================================

export interface EntityConfig {
  odataCollection: string   // OData $metadata collection name (exact case)
  primaryKey: string        // Column used for ON CONFLICT upsert
  syncField: string | null  // OData field to filter on for incremental sync (null = full_refresh)
  syncMode: SyncMode
}

export const ENTITY_CONFIG: Record<EntityName, EntityConfig> = {
  analytics: {
    odataCollection: 'Analytics',
    primaryKey: 'id',
    syncField: 'timestamp',
    syncMode: 'incremental',
  },
  conversations: {
    odataCollection: 'Conversations',
    primaryKey: 'id',
    syncField: 'timestamp',
    syncMode: 'incremental',
  },
  steps: {
    odataCollection: 'Steps',
    primaryKey: 'id',
    syncField: null,
    syncMode: 'full_refresh',
  },
  executed_steps: {
    odataCollection: 'ExecutedSteps',
    primaryKey: 'id',
    syncField: 'timestamp',
    syncMode: 'incremental',
  },
  sessions: {
    odataCollection: 'Sessions',
    primaryKey: 'id',
    syncField: 'startedAt',
    syncMode: 'incremental',
  },
  live_agent_escalations: {
    odataCollection: 'LiveAgentEscalations',
    primaryKey: 'id',
    syncField: 'timestamp',
    syncMode: 'incremental',
  },
  goals: {
    odataCollection: 'Goals',
    primaryKey: 'goalId',
    syncField: 'lastChanged',
    syncMode: 'incremental',
  },
  goal_steps: {
    odataCollection: 'GoalSteps',
    primaryKey: 'goalStepId',
    syncField: null,
    syncMode: 'full_refresh',
  },
  goal_step_metrics: {
    odataCollection: 'GoalStepMetrics',
    primaryKey: 'goalStepMetricId',
    syncField: null,
    syncMode: 'full_refresh',
  },
  goal_events: {
    odataCollection: 'GoalEvents',
    primaryKey: 'id',
    syncField: 'timestamp',
    syncMode: 'incremental',
  },
}

export const ALL_ENTITIES = Object.keys(ENTITY_CONFIG) as EntityName[]
