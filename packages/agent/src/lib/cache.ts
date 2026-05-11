import { createStore } from '../state/ephemeral.js'

const responseCache = createStore<unknown>('responseCache', { maxSize: 1_000 })

export async function getCached<T>(key: string): Promise<T | null> {
  return (await responseCache.get(key)) as T | null
}

export async function setCached<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
  await responseCache.set(key, value, ttlSeconds)
}

export async function _resetForTests(): Promise<void> {
  await responseCache._clear()
}
