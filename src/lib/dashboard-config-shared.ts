export interface DashboardConfig {
  version: 1
  kpiCards: string[]
  chartCards: string[]
}

export interface CardDef {
  id: string
  label: string
  description: string
  section: 'kpi' | 'chart'
  defaultVisible: boolean
  fullWidth?: boolean
}

export const CARD_REGISTRY: CardDef[] = [
  // KPI cards
  { id: 'kpi-sessions',           label: 'Sessions',             description: 'Total sessions in period',                    section: 'kpi',   defaultVisible: true  },
  { id: 'kpi-conversations',      label: 'Conversations',        description: 'Total conversation turns',                   section: 'kpi',   defaultVisible: true  },
  { id: 'kpi-escalations',        label: 'Escalations',          description: 'Escalation count and rate',                  section: 'kpi',   defaultVisible: true  },
  { id: 'kpi-intent-score',       label: 'Avg Intent Score',     description: 'Average NLU confidence score',               section: 'kpi',   defaultVisible: true  },
  { id: 'kpi-goal-events',        label: 'Goal Events',          description: 'Total goal completions',                     section: 'kpi',   defaultVisible: true  },
  { id: 'kpi-containment-rate',   label: 'Containment Rate',     description: 'Sessions resolved without escalation',       section: 'kpi',   defaultVisible: true  },
  { id: 'kpi-unique-users',       label: 'Unique Users',         description: 'Distinct users in period',                   section: 'kpi',   defaultVisible: true  },
  { id: 'kpi-avg-duration',       label: 'Avg Session Length',   description: 'Average session duration',                   section: 'kpi',   defaultVisible: true  },
  { id: 'kpi-goal-completion',    label: 'Goal Completion Rate', description: 'Sessions with at least one goal completion', section: 'kpi',   defaultVisible: false },
  // Chart cards
  { id: 'chart-session-volume',   label: 'Session Volume',          description: 'Sessions per day trend',          section: 'chart', defaultVisible: true  },
  { id: 'chart-unique-users',     label: 'Unique Users per Day',    description: 'Daily distinct user count',       section: 'chart', defaultVisible: true  },
  { id: 'chart-top-intents',      label: 'Top Intents',             description: 'Most triggered intents',         section: 'chart', defaultVisible: true  },
  { id: 'chart-channel-dist',     label: 'Channel Distribution',    description: 'Sessions by channel',            section: 'chart', defaultVisible: true  },
  { id: 'chart-execution-time',   label: 'Avg Execution Time',      description: 'Processing time trend',          section: 'chart', defaultVisible: true  },
  { id: 'chart-nlu-confidence',   label: 'NLU Confidence',          description: 'Intent score distribution',      section: 'chart', defaultVisible: true  },
  { id: 'chart-escalation-trend', label: 'Escalation Trend',        description: 'Daily escalation rate',          section: 'chart', defaultVisible: true  },
  { id: 'chart-top-flows',        label: 'Top Flows',               description: 'Most-executed flows',            section: 'chart', defaultVisible: true,  fullWidth: true },
  { id: 'chart-top-steps',        label: 'Top Executed Steps',      description: 'Most-executed step labels',      section: 'chart', defaultVisible: false, fullWidth: true },
  { id: 'chart-goals-top',        label: 'Top Goals',               description: 'Goals by completion count',      section: 'chart', defaultVisible: true  },
  { id: 'chart-goals-by-day',     label: 'Goal Events by Day',      description: 'Goal completions trend',         section: 'chart', defaultVisible: true  },
  { id: 'section-agent-eval',     label: 'Agent Evaluation',        description: 'Simulator test pass/fail results', section: 'chart', defaultVisible: true, fullWidth: true },
]

export const DEFAULT_CONFIG: DashboardConfig = {
  version: 1,
  kpiCards:   CARD_REGISTRY.filter((c) => c.section === 'kpi'   && c.defaultVisible).map((c) => c.id),
  chartCards: CARD_REGISTRY.filter((c) => c.section === 'chart' && c.defaultVisible).map((c) => c.id),
}
