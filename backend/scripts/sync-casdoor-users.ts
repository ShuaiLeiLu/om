import { PrismaClient } from '@prisma/client'
import { randomUUID } from 'crypto'
import fs from 'fs'

type Env = Record<string, string>

type CasdoorUser = {
  owner: string
  name: string
  id: string
  type: string
  displayName: string
  avatar?: string
  email?: string
  emailVerified?: boolean
  isAdmin?: boolean
  isForbidden?: boolean
  signupApplication?: string
  tag?: string
  groups?: string[]
  properties?: Record<string, string>
}

const prisma = new PrismaClient()

function loadEnvFile(path: string | undefined) {
  if (!path || !fs.existsSync(path)) return
  for (const line of fs.readFileSync(path, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/)
    if (!match || match[1].startsWith('#')) continue
    if (process.env[match[1]] == null) process.env[match[1]] = match[2]
  }
}

function env(): Env {
  loadEnvFile(process.env.ENV_FILE || '.env')
  return process.env as Env
}

function required(config: Env, key: string) {
  const value = String(config[key] || '').trim()
  if (!value) throw new Error(`${key}_required`)
  return value
}

function optional(config: Env, key: string, fallback = '') {
  return String(config[key] || fallback).trim()
}

function casdoorConfig(config: Env) {
  return {
    endpoint: required(config, 'CASDOOR_ENDPOINT').replace(/\/+$/, ''),
    organization: required(config, 'CASDOOR_ORGANIZATION'),
    application: required(config, 'CASDOOR_APPLICATION_NAME'),
    clientId: optional(config, 'CASDOOR_SYNC_CLIENT_ID', config.CASDOOR_CLIENT_ID),
    clientSecret: optional(config, 'CASDOOR_SYNC_CLIENT_SECRET', config.CASDOOR_CLIENT_SECRET)
  }
}

function authHeader(clientId: string, clientSecret: string) {
  if (!clientId || !clientSecret) throw new Error('CASDOOR_SYNC_CLIENT_ID_SECRET_required')
  return `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`
}

function stableName(prefix: string, id: string, email?: string | null, username?: string | null) {
  const candidate = String(email || username || '').trim().toLowerCase()
  const base = candidate
    ? candidate.replace(/@/g, '_at_').replace(/[^a-z0-9_.-]/g, '_')
    : `${prefix}_${id}`
  return base.slice(0, 120)
}

async function casdoorRequest(method: 'GET' | 'POST', path: string, body?: unknown) {
  const cfg = casdoorConfig(env())
  const res = await fetch(`${cfg.endpoint}/api${path}`, {
    method,
    headers: {
      Authorization: authHeader(cfg.clientId, cfg.clientSecret),
      Accept: 'application/json',
      ...(body ? { 'Content-Type': 'application/json' } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  })
  const data = await res.json().catch(async () => ({ status: 'error', msg: await res.text() }))
  if (!res.ok || data.status === 'error') {
    throw new Error(`casdoor_${method}_${path}_failed: ${data.msg || res.status}`)
  }
  return data
}

async function upsertCasdoorUser(user: CasdoorUser, dryRun: boolean) {
  const id = `${user.owner}/${user.name}`
  if (dryRun) return { action: 'dry-run', id }

  const get = await casdoorRequest('GET', `/get-user?id=${encodeURIComponent(id)}`).catch((err) => {
    if (String(err.message).includes('not found')) return null
    return null
  })
  if (get?.data?.name) {
    await casdoorRequest('POST', `/update-user?id=${encodeURIComponent(id)}`, user)
    return { action: 'updated', id }
  }
  await casdoorRequest('POST', '/add-user', user)
  return { action: 'created', id }
}

async function main() {
  const args = new Set(process.argv.slice(2))
  const dryRun = args.has('--dry-run')
  const checkConfig = args.has('--check-config')
  const cfg = casdoorConfig(env())
  const now = new Date().toISOString()
  if (checkConfig) {
    await casdoorRequest('GET', `/get-users?owner=${encodeURIComponent(cfg.organization)}`)
    console.log(JSON.stringify({
      ok: true,
      source: 'chatty',
      mode: 'check-config',
      endpoint: cfg.endpoint,
      organization: cfg.organization,
      application: cfg.application
    }, null, 2))
    return
  }

  const [users, admins] = await Promise.all([
    prisma.user.findMany({
      select: {
        id: true,
        displayName: true,
        avatarUrl: true,
        email: true,
        casdoorSubject: true,
        status: true,
        createdAt: true
      }
    }),
    prisma.adminUser.findMany({
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        status: true,
        createdAt: true
      }
    })
  ])

  let created = 0
  let updated = 0
  let preview = 0
  for (const local of users) {
    const item = await upsertCasdoorUser({
      owner: cfg.organization,
      name: stableName('chatty_user', local.id, local.email),
      id: local.id,
      type: 'normal-user',
      displayName: local.displayName || local.email || `万模用户 ${local.id.slice(0, 8)}`,
      avatar: local.avatarUrl || undefined,
      email: local.email || undefined,
      emailVerified: Boolean(local.email),
      isForbidden: local.status !== 'active',
      signupApplication: cfg.application,
      tag: 'chatty',
      groups: ['chatty:user'],
      properties: {
        sourceSystem: 'chatty',
        localUserId: local.id,
        casdoorSubject: local.casdoorSubject || '',
        syncedAt: now
      }
    }, dryRun)
    if (item.action === 'created') created += 1
    else if (item.action === 'updated') updated += 1
    else preview += 1
  }

  for (const local of admins) {
    const item = await upsertCasdoorUser({
      owner: cfg.organization,
      name: stableName('chatty_admin', local.id, local.email, local.username),
      id: local.id || randomUUID(),
      type: 'normal-user',
      displayName: local.username || local.email,
      email: local.email,
      emailVerified: true,
      isAdmin: true,
      isForbidden: local.status !== 'active',
      signupApplication: cfg.application,
      tag: 'chatty-admin',
      groups: [`chatty:${local.role}`, 'chatty:admin'],
      properties: {
        sourceSystem: 'chatty',
        localAdminId: local.id,
        adminRole: local.role,
        syncedAt: now
      }
    }, dryRun)
    if (item.action === 'created') created += 1
    else if (item.action === 'updated') updated += 1
    else preview += 1
  }

  console.log(JSON.stringify({
    ok: true,
    dryRun,
    source: 'chatty',
    localUsers: users.length,
    localAdmins: admins.length,
    created,
    updated,
    preview
  }, null, 2))
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
