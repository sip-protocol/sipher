export const AGENTS = {
  sipher: { name: 'SIPHER', color: '#10B981', role: 'Lead Agent' },
  herald: { name: 'HERALD', color: '#3B82F6', role: 'X Agent' },
  sentinel: { name: 'SENTINEL', color: '#F59E0B', role: 'Monitor' },
  courier: { name: 'COURIER', color: '#8B5CF6', role: 'Executor' },
} as const

export type AgentName = keyof typeof AGENTS
