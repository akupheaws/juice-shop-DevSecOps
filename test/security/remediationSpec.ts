import { strict as assert } from 'assert'
import { createHmac } from 'crypto'
import { spawnSync } from 'child_process'
import { Sequelize } from 'sequelize'
import { UserModel, UserModelInit } from '../../models/user'
import { ProductModel, ProductModelInit } from '../../models/product'
import { BasketModelInit } from '../../models/basket'
import { seedCredentials } from '../../lib/seedCredentials'
import sinon = require('sinon')

const security = require('../../lib/insecurity')
const cache = require('../../data/datacache')
const login = require('../../routes/login')
const search = require('../../routes/search')

function invoke (handler: any, request: any): Promise<{ status: number, body: any }> {
  return new Promise((resolve, reject) => {
    let status = 200
    const response: any = {
      __: (value: string) => value,
      status: (value: number) => { status = value; return response },
      json: (body: any) => resolve({ status, body }),
      send: (body: any) => resolve({ status, body })
    }
    handler(request, response, reject)
  })
}

describe('CSV security remediations', () => {
  const db = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false })

  before(async () => {
    UserModelInit(db)
    ProductModelInit(db)
    BasketModelInit(db)
    await db.sync()
    const password = seedCredentials('regression_account').password
    const user = await UserModel.create({ email: 'regression@example.test', password })
    cache.users.admin = { id: -1 }
    cache.users.jim = { id: -2 }
    cache.users.bender = { id: -3 }
    cache.users.chris = { id: -4 }
    assert.ok(user.id)
    await ProductModel.create({ name: 'Apple juice', description: 'Apple drink', price: 1, deluxePrice: 1, image: 'apple.png' })
    const deleted = await ProductModel.create({ name: 'Deleted juice', description: 'Old drink', price: 1, deluxePrice: 1, image: 'old.png' })
    await deleted.destroy()
  })

  after(async () => { await db.close() })

  it('keeps valid login working with a freshly signed token', async () => {
    const result = await invoke(login(), { body: { email: 'regression@example.test', password: seedCredentials('regression_account').password } })
    assert.equal(result.status, 200)
    assert.equal(security.verify(result.body.authentication.token), true)
  })

  it('rejects SQL injection in email and password', async () => {
    for (const body of [
      { email: "' OR 1=1--", password: '' },
      { email: 'regression@example.test', password: "' OR 1=1--" }
    ]) assert.equal((await invoke(login(), { body })).status, 401)
  })

  it('rejects structured login inputs instead of treating them as query operators', async () => {
    for (const body of [
      { email: { $ne: null }, password: 'test' },
      { email: 'regression@example.test', password: ['test'] },
      {}
    ]) assert.equal((await invoke(login(), { body })).status, 400)
  })

  it('does not authenticate a soft-deleted user', async () => {
    const password = seedCredentials('deleted_account').password
    const user = await UserModel.create({ email: 'deleted@example.test', password })
    await user.destroy()
    assert.equal((await invoke(login(), { body: { email: 'deleted@example.test', password } })).status, 401)
  })

  it('returns matching active products', async () => {
    const result = await invoke(search(), { query: { q: 'Apple' }, __: (value: string) => value })
    assert.equal(result.status, 200)
    assert.deepEqual(result.body.data.map((p: any) => p.name), ['Apple juice'])
  })

  it('does not expose users or database schema through injected search', async () => {
    for (const q of ["')) UNION SELECT * FROM Users--", "')) UNION SELECT sql FROM sqlite_master--", "')) OR 1=1--"]) {
      const result = await invoke(search(), { query: { q }, __: (value: string) => value })
      assert.equal(result.status, 200)
      assert.deepEqual(result.body.data, [])
    }
  })

  it('rejects non-string search parameters and excludes deleted products', async () => {
    assert.equal((await invoke(search(), { query: { q: ['Apple'] } })).status, 400)
    assert.equal((await invoke(search(), { query: { q: {} } })).status, 400)
    const result = await invoke(search(), { query: {}, __: (value: string) => value })
    assert.equal(result.body.data.length, 1)
  })

  it('rejects unsigned tokens, algorithm confusion, and malformed tokens', () => {
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')
    const payload = Buffer.from(JSON.stringify({ data: { id: 1, role: 'admin' } })).toString('base64url')
    const signature = createHmac('sha256', security.publicKey).update(`${header}.${payload}`).digest('base64url')
    assert.equal(security.verify(`${header}.${payload}.${signature}`), false)
    assert.equal(security.verify(`${Buffer.from('{"alg":"none"}').toString('base64url')}.${payload}.`), false)
    assert.equal(security.verify('malformed'), false)
    assert.equal(security.verify(undefined), false)
  })

  it('enforces token expiry', () => {
    const token = security.authorize({ data: { id: 1 } })
    const clock = sinon.useFakeTimers({ now: Date.now() + 6 * 60 * 60 * 1000, toFake: ['Date'] })
    try { assert.equal(security.verify(token), false) } finally { clock.restore() }
  })

  it('does not allow temporary 2FA tokens to authenticate application requests', async () => {
    const token = security.authorize({ userId: 1, type: 'password_valid_needs_second_factor_token' })
    assert.equal((await invoke(security.isAuthorized(), { headers: { authorization: `Bearer ${token}` } })).status, 401)
  })

  it('does not cache temporary 2FA tokens as authenticated users', () => {
    const token = security.authorize({ userId: 1, type: 'password_valid_needs_second_factor_token' })
    let continued = false
    security.updateAuthenticatedUsers()({ headers: { authorization: `Bearer ${token}` }, cookies: {} }, {}, () => { continued = true })
    assert.equal(continued, true)
    assert.equal(security.authenticatedUsers.get(token), undefined)
  })

  it('generates unpredictable seed passwords and omits public TOTP secrets', () => {
    const first = seedCredentials('random_seed_one')
    const second = seedCredentials('random_seed_two')
    assert.ok(first.password.length >= 40)
    assert.notEqual(first.password, second.password)
    assert.equal(first.totpSecret, '')
  })

  it('refuses production startup without an externally supplied signing key', () => {
    const result = spawnSync(process.execPath, ['-r', 'ts-node/register', '-e', "require('./lib/insecurity')"], {
      env: { ...process.env, NODE_ENV: 'production', JWT_PRIVATE_KEY_FILE: '' },
      encoding: 'utf8'
    })
    assert.notEqual(result.status, 0)
    assert.ok(result.stderr.includes('JWT_PRIVATE_KEY_FILE is required in production'))
  })
})
