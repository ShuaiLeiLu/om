import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const username = process.env.DEFAULT_ADMIN_USERNAME || 'admin'
  const email = process.env.DEFAULT_ADMIN_EMAIL || 'admin@example.com'
  const casdoorSubject = process.env.DEFAULT_ADMIN_CASDOOR_SUBJECT || null

  await prisma.adminUser.upsert({
    where: { username },
    update: { email, ...(casdoorSubject ? { casdoorSubject } : {}) },
    create: { username, email, casdoorSubject, role: 'owner' }
  })

  await prisma.adRewardConfig.upsert({
    where: { id: 'default' },
    update: {
      enabled: true,
      adUnitId: process.env.WECHAT_REWARDED_VIDEO_AD_UNIT_ID || ''
    },
    create: {
      id: 'default',
      enabled: true,
      adUnitId: process.env.WECHAT_REWARDED_VIDEO_AD_UNIT_ID || ''
    }
  })

  const models = [
    ['openai', 'GPT-5.5', 'gpt-5.5', 10],
    ['openai', 'GPT-5.4', 'gpt-5.4', 20],
    ['openai', 'GPT-5.4 Mini', 'gpt-5.4-mini', 30],
    ['openai', 'GPT-5.3 Codex Spark', 'gpt-5.3-codex-spark', 40],
    ['openai', 'GPT-5.3 Codex', 'gpt-5.3-codex', 50],
    ['openai', 'Codex Auto Review', 'codex-auto-review', 60],
    ['openai', 'GPT Image 2', 'gpt-image-2', 70, '文生图 image generation'],
    ['gemini', 'Gemini 2.5 Pro', 'gemini-2.5-pro', 80],
    ['gemini', 'Gemini 2.5 Flash', 'gemini-2.5-flash', 90],
    ['midjourney', 'MJ 生图', 'midjourney', 100, 'Midjourney 文生图 image generation']
  ] as const

  for (const [provider, displayName, sub2apiModel, sortOrder, remark] of models) {
    await prisma.modelConfig.upsert({
      where: { sub2apiModel },
      update: { provider, displayName, sortOrder, ...(remark ? { remark } : {}) },
      create: { provider, displayName, sub2apiModel, sortOrder, remark: remark || '' }
    })
  }
}

main()
  .finally(async () => prisma.$disconnect())
