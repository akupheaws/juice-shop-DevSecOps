import { randomBytes } from 'crypto'

interface Credentials { password: string, totpSecret: string }
const credentials = new Map<string, Credentials>()

export function seedCredentials (key: string): Credentials {
  const cached = credentials.get(key)
  if (cached) return cached
  // Predictable accounts exist only in explicitly selected automated test runs.
  const fixture = process.env.NODE_ENV === 'test'
    ? require('../test/fixtures/seed-credentials.json')[key]
    : undefined
  const prefix = `JUICE_SEED_${key.replace(/[^a-z0-9]/gi, '_').toUpperCase()}`
  const value = {
    password: process.env[`${prefix}_PASSWORD`] ?? fixture?.password ?? randomBytes(32).toString('base64url'),
    totpSecret: process.env[`${prefix}_TOTP_SECRET`] ?? fixture?.totpSecret ?? ''
  }
  credentials.set(key, value)
  return value
}
