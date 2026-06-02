export interface ContentTheme {
  day: string
  theme: string
  focus: string
}

const CALENDAR: Record<number, ContentTheme> = {
  0: { day: 'Sun', theme: 'Vision', focus: 'the bigger privacy-standard vision and a roadmap teaser' },
  1: { day: 'Mon', theme: 'SDK tip', focus: 'a concrete @sip-protocol/sdk code tip or snippet developers can use' },
  2: { day: 'Tue', theme: 'Privacy explainer', focus: 'one privacy concept — stealth addresses, Pedersen commitments, or viewing keys' },
  3: { day: 'Wed', theme: 'Ecosystem', focus: 'the Solana privacy ecosystem and where SIP fits' },
  4: { day: 'Thu', theme: 'Bounty spotlight', focus: 'SIP developer bounties and how to participate' },
  5: { day: 'Fri', theme: 'Week in SIP', focus: "the week's shipped progress drawn from the GitHub activity below" },
  6: { day: 'Sat', theme: 'Community', focus: 'a contributor, integration, or community moment worth celebrating' },
}

export function themeForDate(date: Date): ContentTheme {
  return CALENDAR[date.getUTCDay()]
}
