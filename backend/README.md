# Chatty Backend

Chatty / 万模AI 自有后端，基于 NestJS + Prisma 提供用户认证、聊天代理、图片生成、积分、兑换码、充值、奖励、后台管理、微信生态与对象存储能力。

> 最后更新：2026-06-07。本文按当前 `backend/src/modules`、`backend/.env.example` 与 Prisma 迁移整理。

## 技术栈

- NestJS + TypeScript
- Prisma + PostgreSQL
- Redis / BullMQ 依赖已接入，当前主要用于会话、限流、任务能力预留和后续异步队列
- Sub2API 作为模型网关；用量计价由 Chatty 本地积分规则负责
- MinIO / S3 兼容对象存储
- Nodemailer 邮件验证码

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
NODE_ENV
PORT
APP_ORIGIN
DATABASE_URL
REDIS_URL
COOKIE_SECRET
ADMIN_SESSION_SECRET
USER_SESSION_SECRET
CASDOOR_ENDPOINT
CASDOOR_CLIENT_ID
CASDOOR_CLIENT_SECRET
CASDOOR_REDIRECT_URI
WECHAT_MINIAPP_APP_ID
WECHAT_MINIAPP_APP_SECRET
WECHAT_OPEN_APP_ID
WECHAT_OPEN_APP_SECRET
WECHAT_OPEN_REDIRECT_URI
WECHAT_OFFIACCOUNT_APP_ID
WECHAT_OFFIACCOUNT_APP_SECRET
WECHAT_REWARDED_VIDEO_AD_UNIT_ID
SUB2API_BASE_URL
SUB2API_GATEWAY_API_KEY
SUB2API_IMAGE_GATEWAY_API_KEY
POINT_PRICE_CHAT
POINT_PRICE_IMAGE_GENERATION
POINT_PRICE_IMAGE_EDIT
MINIO_ENDPOINT
MINIO_PUBLIC_ENDPOINT
MINIO_ACCESS_KEY
MINIO_SECRET_KEY
MINIO_BUCKET
SMTP_HOST
SMTP_USER
SMTP_PASS
DEFAULT_ADMIN_EMAIL
DEFAULT_ADMIN_PASSWORD
```

不要把真实密钥提交到代码仓库。

## 模块清单

| 模块 | 说明 |
| --- | --- |
| `auth` | 用户 session、Casdoor、邮箱密码、微信 OAuth、邮箱验证码 |
| `admin` | 管理员登录、用户管理、积分调整、请求审计、微信绑定管理 |
| `chat` | 会话、消息、SSE 聊天、文本生图、参考图编辑 |
| `images` | 参考图上传、图片任务历史、私有图片读取、存储统计 |
| `models` | 模型列表与后台开关 |
| `points` | 积分账户与积分流水 |
| `redeem` | 兑换码 |
| `recharge` | 充值订单与充值发放 |
| `rewards` | 激励广告 reward session 与 claim |
| `wechat` | 小程序登录、二维码、登录码 |
| `storage` | MinIO/S3 封装 |
| `sub2api` | Sub2API 网关与管理 API 封装 |
| `mailer` | SMTP 邮件发送 |
| `miniapp-ai` | 小程序 AI 入口 |

## 已实现的主链路

- 健康检查：`GET /api/health`
- `GET /api/auth/capabilities` 登录能力探测
- Casdoor OAuth 登录与回调
- 邮箱验证码注册、登录、找回密码、修改密码
- 微信开放平台 Web OAuth 与公众号 H5 OAuth
- 普通用户微信小程序扫码登录 Web
- 小程序 `wx.login -> code2Session` 后端入口
- 普通用户 Cookie session
- 管理员账号密码登录
- 用户禁用/启用
- 管理员手动调积分
- 积分账户与积分流水
- 套餐与兑换码
- 模型列表与后台模型开关
- SSE 聊天代理到 Sub2API
- 会话与消息服务端保存
- 广告奖励配置、reward session、claim
- 流式响应原始用量入库，并按本地积分规则扣费
- 微信小程序码图片生成接口
- 前端接入 `/api/chat/completions` SSE
- 图片生成与编辑：`/api/images/generations`、`/api/images/edits`
- 图片上传、任务历史、私有读取和存储统计：`/api/images/uploads`、`/api/images/tasks`、`/api/images/:id`
- 充值订单和积分发放
- Nginx `/api/*` 反代到 `chatty-backend:3001`
- 后台 llm requests、积分流水、audit logs、微信绑定查询和解绑接口

## 生产注意事项

- `CASDOOR_AUTH_REQUIRED=true` 会隐藏并禁用本地/微信网页登录入口，只保留 Casdoor。
- `SUB2API_IMAGE_GATEWAY_API_KEY` 可与文本 key 池分开，避免图片模型被文本分组限制影响。
- MinIO bucket 建议保持 private，图片访问由后端鉴权后返回或代理。
- `POINT_PRICE_*` 是本地积分定价，模型返回 token 只作为审计信息。
- 生产迁移使用 `npm run prisma:deploy`，不要在生产环境运行交互式 `prisma migrate dev`。

## 验证命令

```bash
npm run prisma:generate
npm run lint
npm run build
```
