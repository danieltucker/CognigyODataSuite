import type { EntityName } from '@/db/schema'

export type ColumnType = 'string' | 'number' | 'timestamp' | 'json' | 'boolean'

export interface ColDef {
  key: string
  label: string
  type: ColumnType
  defaultVisible: boolean
}

export interface EntityColsConfig {
  cols: ColDef[]
  searchCols: string[]
  dateCol: string | null
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TIMESTAMP_COLS = new Set(['timestamp', 'startedAt', 'createdAt', 'lastChanged', 'expiresAt', '_imported_at'])
const NUMBER_COLS = new Set(['intentScore', 'executionTime', 'execution', 'stepsCount', 'handoverEscalations', 'version', 'order', 'value'])
const BOOLEAN_COLS = new Set(['inHandoverRequest', 'inHandoverConversation'])
const JSON_COLS = new Set(['completedGoalsList', 'foundSlots', 'foundSlotDetails', 'goals', 'stepPath', 'labels', 'inputData', 'inputAttachments'])

function colType(key: string): ColumnType {
  if (TIMESTAMP_COLS.has(key)) return 'timestamp'
  if (NUMBER_COLS.has(key)) return 'number'
  if (BOOLEAN_COLS.has(key)) return 'boolean'
  if (JSON_COLS.has(key)) return 'json'
  return 'string'
}

function colLabel(key: string): string {
  return key
    .replace(/^_+/, '')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .replace(/\bId\b/g, 'ID')
    .replace(/\bUrl\b/g, 'URL')
    .trim()
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

function c(key: string, visible: boolean): ColDef {
  return { key, label: colLabel(key), type: colType(key), defaultVisible: visible }
}

const v = (key: string) => c(key, true)
const h = (key: string) => c(key, false)

// ---------------------------------------------------------------------------
// Per-entity column configs
// ---------------------------------------------------------------------------

export const ENTITY_COLS: Record<EntityName, EntityColsConfig> = {
  analytics: {
    cols: [
      v('timestamp'), v('sessionId'), v('contactId'), v('inputText'), v('intent'),
      v('intentScore'), v('channel'), v('state'),
      h('mode'), h('userType'), h('flowLanguage'), h('intentFlow'), h('executionTime'),
      h('execution'), h('ip'), h('entrypoint'), h('inputId'), h('inputData'),
      h('completedGoalsList'), h('foundSlots'), h('foundSlotDetails'),
      h('custom1'), h('custom2'), h('custom3'), h('custom4'), h('custom5'),
      h('custom6'), h('custom7'), h('custom8'), h('custom9'), h('custom10'),
      h('projectId'), h('flowReferenceId'), h('organisation'),
      h('localeReferenceId'), h('localeName'), h('endpointUrlToken'), h('endpointName'),
      h('rating'), h('ratingComment'), h('snapshotName'),
      h('id'), h('_id'), h('_imported_at'),
    ],
    searchCols: ['sessionId', 'contactId', 'inputText', 'intent', 'channel', 'endpointName', 'localeName'],
    dateCol: 'timestamp',
  },

  conversations: {
    cols: [
      v('timestamp'), v('sessionId'), v('contactId'), v('inputText'),
      v('type'), v('source'), v('channel'), v('flowName'),
      h('projectName'), h('inputId'), h('inputData'), h('flowParentId'),
      h('inHandoverRequest'), h('inHandoverConversation'), h('outputId'),
      h('inputAttachments'), h('reference'),
      h('projectId'), h('organisation'),
      h('localeReferenceId'), h('endpointUrlToken'), h('endpointName'),
      h('snapshotId'), h('snapshotName'), h('rating'), h('ratingComment'),
      h('id'), h('_id'), h('_imported_at'),
    ],
    searchCols: ['sessionId', 'contactId', 'inputText', 'flowName', 'channel', 'endpointName'],
    dateCol: 'timestamp',
  },

  steps: {
    cols: [
      v('label'), v('type'), v('flowName'), v('projectName'),
      h('entityReferenceId'), h('flowReferenceId'), h('snapshotId'), h('snapshotName'),
      h('id'), h('_id'), h('_imported_at'),
    ],
    searchCols: ['label', 'type', 'flowName', 'projectName'],
    dateCol: null,
  },

  executed_steps: {
    cols: [
      v('timestamp'), v('sessionId'), v('stepLabel'), v('type'), v('flowName'),
      h('userId'), h('inputId'), h('parentStep'), h('entityReferenceId'), h('flowReferenceId'),
      h('projectName'), h('projectId'), h('organisationId'),
      h('localeReferenceId'), h('localeName'), h('endpointUrlToken'), h('endpointName'),
      h('snapshotId'), h('snapshotName'),
      h('id'), h('_id'), h('_imported_at'),
    ],
    searchCols: ['sessionId', 'stepLabel', 'type', 'flowName', 'endpointName'],
    dateCol: 'timestamp',
  },

  sessions: {
    cols: [
      v('startedAt'), v('sessionId'), v('userId'), v('stepsCount'),
      v('handoverEscalations'), v('endpointName'),
      h('goals'), h('stepPath'), h('localeName'), h('projectName'),
      h('endpointReferenceId'), h('projectId'), h('organisationId'),
      h('localeReferenceId'), h('endpointUrlToken'),
      h('snapshotId'), h('snapshotName'), h('rating'), h('ratingComment'),
      h('id'), h('_id'), h('_imported_at'),
    ],
    searchCols: ['sessionId', 'userId', 'endpointName', 'projectName', 'localeName'],
    dateCol: 'startedAt',
  },

  live_agent_escalations: {
    cols: [
      v('timestamp'), v('sessionId'), v('status'), v('inboxName'),
      v('agentName'), v('channel'),
      h('contactId'), h('teamName'), h('endpointName'), h('endpointType'),
      h('localeName'), h('inboxId'), h('teamId'), h('agentId'), h('labels'),
      h('projectId'), h('organisationId'),
      h('localeReferenceId'), h('endpointUrlToken'), h('snapshotId'), h('snapshotName'),
      h('id'), h('_id'), h('_imported_at'),
    ],
    searchCols: ['sessionId', 'status', 'inboxName', 'agentName', 'channel', 'endpointName'],
    dateCol: 'timestamp',
  },

  goals: {
    cols: [
      v('name'), v('version'), v('description'), v('createdAt'), v('lastChanged'),
      h('referenceId'), h('createdBy'), h('lastChangedBy'),
      h('projectId'), h('organisationId'),
      h('goalId'), h('_imported_at'),
    ],
    searchCols: ['name', 'description', 'createdBy'],
    dateCol: 'lastChanged',
  },

  goal_steps: {
    cols: [
      v('name'), v('order'), v('type'), v('text'), v('goalId'),
      h('version'), h('description'), h('projectId'), h('organisationId'),
      h('goalStepId'), h('_imported_at'),
    ],
    searchCols: ['name', 'type', 'text', 'goalId'],
    dateCol: null,
  },

  goal_step_metrics: {
    cols: [
      v('name'), v('type'), v('value'), v('goalId'), v('goalStepId'),
      h('version'), h('description'), h('projectId'), h('organisationId'),
      h('goalStepMetricId'), h('_imported_at'),
    ],
    searchCols: ['name', 'type', 'goalId'],
    dateCol: null,
  },

  goal_events: {
    cols: [
      v('timestamp'), v('sessionId'), v('goalId'), v('endpointName'), v('channel'),
      h('version'), h('goalCycleId'), h('stepId'), h('localeName'), h('endpointType'),
      h('expiresAt'), h('projectId'), h('organisationId'),
      h('localeReferenceId'), h('endpointUrlToken'), h('snapshotId'), h('snapshotName'),
      h('id'), h('_imported_at'),
    ],
    searchCols: ['sessionId', 'goalId', 'endpointName', 'channel'],
    dateCol: 'timestamp',
  },
}
