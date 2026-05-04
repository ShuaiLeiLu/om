import { PrismaClient } from '@prisma/client'
import * as argon2 from 'argon2'

const prisma = new PrismaClient()

async function main() {
  const username = process.env.DEFAULT_ADMIN_USERNAME || 'admin'
  const email = process.env.DEFAULT_ADMIN_EMAIL || 'admin@example.com'
  const password = process.env.DEFAULT_ADMIN_PASSWORD || 'change-me-now'

  const passwordHash = await argon2.hash(password)
  await prisma.adminUser.upsert({
    where: { username },
    update: { email },
    create: { username, email, passwordHash, role: 'owner' }
  })

  await prisma.adRewardConfig.upsert({
    where: { id: 'default' },
    update: {},
    create: { id: 'default' }
  })

  const models = [
    ['openai', 'GPT-5.5', 'gpt-5.5', 10],
    ['openai', 'GPT-5.4', 'gpt-5.4', 20],
    ['gemini', 'Gemini 3 Pro', 'gemini-3-pro-preview', 30],
    ['deepseek', 'DeepSeek V4 Flash', 'deepseek-ai/deepseek-v4-flash', 40],
    ['qwen', 'Qwen3 Coder 480B', 'qwen/qwen3-coder-480b-a35b-instruct', 50],
    ['moonshot', 'Kimi K2 Thinking', 'moonshotai/kimi-k2-thinking', 60],
    ['grok', 'Grok 4.1 Fast', 'grok-4.1-fast', 70]
  ] as const

  for (const [provider, displayName, sub2apiModel, sortOrder] of models) {
    await prisma.modelConfig.upsert({
      where: { sub2apiModel },
      update: { provider, displayName, sortOrder },
      create: { provider, displayName, sub2apiModel, sortOrder }
    })
  }
}

main()
  .finally(async () => prisma.$disconnect())
