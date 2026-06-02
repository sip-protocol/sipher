import { describe, it, expect } from 'vitest'
import { themeForDate } from '../../../src/herald/content/calendar.js'

describe('themeForDate', () => {
  // Anchor dates: 2023-01-01 (UTC) is a Sunday, 01-02 Monday, ... 01-07 Saturday.
  it('maps each UTC weekday to its theme', () => {
    expect(themeForDate(new Date('2023-01-01T12:00:00Z')).theme).toBe('Vision')        // Sun
    expect(themeForDate(new Date('2023-01-02T12:00:00Z')).theme).toBe('SDK tip')       // Mon
    expect(themeForDate(new Date('2023-01-03T12:00:00Z')).theme).toBe('Privacy explainer') // Tue
    expect(themeForDate(new Date('2023-01-04T12:00:00Z')).theme).toBe('Ecosystem')     // Wed
    expect(themeForDate(new Date('2023-01-05T12:00:00Z')).theme).toBe('Bounty spotlight') // Thu
    expect(themeForDate(new Date('2023-01-06T12:00:00Z')).theme).toBe('Week in SIP')   // Fri
    expect(themeForDate(new Date('2023-01-07T12:00:00Z')).theme).toBe('Community')     // Sat
  })

  it('returns a focus string and day label', () => {
    const t = themeForDate(new Date('2023-01-02T12:00:00Z'))
    expect(t.day).toBe('Mon')
    expect(t.focus.length).toBeGreaterThan(0)
  })
})
