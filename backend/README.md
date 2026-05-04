# Chatty Backend

Chatty / 万模AI 自有后端，按 `docs/后端PRD.md` 第一版实现。

## 技术栈

- NestJS + TypeScript
- Prisma + PostgreSQL
- Redis/BullMQ 预留
- Sub2API 作为模型网关和 usage 来源

## 本地启动

```bash
cd backend
cp .env.example .env
npm install --cache ./.npm-cache
npm run prisma:generate
npm run prisma:migrate
npm run seed
npm run dev
```

默认端口：

```text
http://localhost:3001/api
```

## 关键环境变量

```text
DATABASE_URL
REDIS_URL
WECHAT_MINIAPP_APP_ID
WECHAT_MINIAPP_APP_SECRET
WECHAT_REWARDED_VIDEO_AD_UNIT_ID
SUB2API_BASE_URL
SUB2API_GATEWAY_API_KEY
SUB2API_ADMIN_EMAIL
SUB2API_ADMIN_PASSWORD
```

不要把真实密钥提交到代码仓库。

## 已实现的主链路

- 健康检查：`GET /api/health`
- 普通用户微信小程序扫码登录 Web
- 小程序 `wx.login -> code2Session` 后端入口
- 普通用户 Cookie session
- 管理员账号密码登录
- 用户禁用/启用
- 管理员手动调 token
- token grant 与 quota ledger
- 套餐与兑换码
- 模型列表与后台模型开关
- SSE 聊天代理到 Sub2API
- 会话与消息服务端保存
- 广告奖励配置、reward session、claim
- Sub2API usage 手动 ingest 和同步状态骨架

## 仍需接入生产细节

- Sub2API admin usage 真实接口的分页和游标同步。
- 微信小程序码图片真实生成接口。
- 前端接入 `/api/chat/completions` SSE。
- 后台管理 UI。
- 腾讯云 Caddy `/api/*` 反代到 `chatty-backend:3001`。

## 验证命令

```bash
npm run prisma:generate
npm run build
```
