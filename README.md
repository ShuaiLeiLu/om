# Chatty / 万模AI

Chatty / 万模AI 是一个面向多模型 AI 服务的全栈应用，包含 Web 端、后端服务和微信小程序端。项目支持多模型聊天、图片生成、用户登录、额度与兑换码、广告奖励、后台管理，以及通过 Sub2API 统一转发模型请求。

> 最后更新：2026-06-07。本文按当前仓库代码与环境变量模板整理。
>
> 主文档以中文维护；英文说明见文末 [English Quick Reference](#english-quick-reference)。

## 功能概览

- Web 应用：基于 Next.js，提供聊天、图片生成、个人中心、登录和后台管理页面。
- 后端服务：基于 NestJS + Prisma，提供用户认证、会话、模型、额度、兑换码、奖励、管理后台和 Sub2API 代理接口。
- 微信小程序：提供小程序入口、奖励页、个人中心、网页登录码和扫码登录能力。
- 模型接入：通过 Sub2API 统一接入 OpenAI、Gemini、DeepSeek、智谱、通义千问、Moonshot、Grok 等模型。
- 统一登录：支持 Casdoor、邮箱密码、微信开放平台网页登录、微信公众号 H5 授权、小程序登录与扫码登录；`CASDOOR_AUTH_REQUIRED=true` 时只允许 Casdoor 登录。
- 图片生成：支持文本生图、参考图编辑、multipart 参考图上传、服务端任务历史、MinIO/S3 对象存储、图片使用统计和短期私有访问。
- 生产部署：提供前端、后端 Dockerfile 和 `docker-compose.prod.yml`。

## 技术栈

| 模块 | 技术 |
| --- | --- |
| Web 前端 | Next.js 16、React 19、Tailwind CSS、Zustand、Radix UI |
| 后端 | NestJS 11、TypeScript、Prisma、PostgreSQL、Redis/BullMQ 预留 |
| 模型网关 | Sub2API |
| 图片存储 | MinIO / S3 兼容对象存储 |
| 小程序 | 微信小程序原生框架 |
| 部署 | Docker、Docker Compose、Nginx 反向代理配置 |

## 目录结构

```text
.
├── src/                  # Next.js Web 应用
│   ├── app/              # 页面路由
│   ├── components/       # UI、聊天、图片、认证、后台组件
│   ├── lib/              # API、配置和工具函数
│   └── store/            # Zustand 状态管理
├── backend/              # NestJS 后端服务
│   ├── prisma/           # Prisma schema、迁移和 seed
│   └── src/modules/      # auth、chat、images、admin、points、recharge 等业务模块
├── miniprogram/          # 微信小程序
├── docs/                 # 后端图片与 MinIO 相关设计文档
├── public/               # 静态资源
├── scripts/dev.mjs       # 同时启动前后端的本地开发脚本
├── Dockerfile            # Web 前端镜像
├── backend/Dockerfile    # 后端镜像
└── docker-compose.prod.yml
```

## 环境要求

- Node.js 22 或兼容版本
- npm
- PostgreSQL
- Redis（当前部分队列能力预留，生产环境建议准备）
- 可用的 Sub2API 服务
- 微信小程序 / 微信开放平台配置（如需微信登录、小程序和扫码登录）
- MinIO 或 S3 兼容对象存储（如需图片生成与文件存储）

## 本地启动

### 1. 安装依赖

```bash
npm install
npm install --prefix backend
```

### 2. 配置后端环境变量

```bash
cp backend/.env.example backend/.env
```

按本地环境修改 `backend/.env`，至少需要确认：

- `DATABASE_URL`
- `REDIS_URL`
- `COOKIE_SECRET`
- `ADMIN_SESSION_SECRET`
- `USER_SESSION_SECRET`
- `SUB2API_BASE_URL`
- `SUB2API_GATEWAY_API_KEY`
- `SUB2API_IMAGE_GATEWAY_API_KEY`（图片模型可使用独立 key 池）
- `CASDOOR_*`（启用统一登录时）
- `SUB2API_ADMIN_*`
- `MINIO_*`（启用图片存储时）
- `WECHAT_*`（启用微信相关能力时）
- `SMTP_*`（启用邮箱验证码与找回密码时）

不要把真实密钥提交到代码仓库。

### 3. 初始化数据库

```bash
npm run prisma:generate --prefix backend
npm run prisma:migrate --prefix backend
npm run seed --prefix backend
```

### 4. 启动开发环境

```bash
npm run dev
```

该命令会先启动后端，等待 `http://127.0.0.1:3001/api/health` 就绪后再启动前端。

默认地址：

- Web 前端：`http://localhost:3000`
- 后端 API：`http://localhost:3001/api`

也可以分别启动：

```bash
npm run dev:backend
npm run dev:frontend
```

## 微信小程序配置

小程序本地配置示例位于：

```text
miniprogram/utils/config.local.example.js
```

按需复制为本地配置文件，并配置：

- `BASE_URL`：后端 API 地址
- `WEB_URL`：Web 端地址
- `WECHAT_APP_ID`：小程序 AppID
- `REWARDED_VIDEO_AD_UNIT_ID`：激励视频广告位 ID

## 认证与账户

当前后端同时提供多种登录入口，前端通过 `GET /api/auth/capabilities` 动态显示可用方式：

- Casdoor OAuth：`/api/auth/casdoor/start`、`/api/auth/casdoor/callback`
- 邮箱密码：注册、登录、修改密码、找回密码和邮箱验证码
- 微信开放平台网页登录：`/api/auth/wechat/oauth/start?mode=web`
- 微信公众号 H5 授权：`/api/auth/wechat/oauth/start?mode=h5`
- 微信小程序：`wx.login -> code2Session`、网页登录二维码和登录码

管理后台有独立 session 与账号体系，默认管理员由 `backend/prisma/seed.ts` 和 `DEFAULT_ADMIN_*` 环境变量初始化。

## 图片与存储

图片链路已服务端化：

- `POST /api/images/generations`：文本生图
- `POST /api/images/edits`：参考图编辑，支持 multipart `images`、旧版 data URL，以及服务端 `imageIds`
- `POST /api/images/uploads`：上传参考图到对象存储并返回图片元数据
- `GET /api/images/tasks`：读取当前用户图片任务历史
- `GET /api/images/:id`、`GET /api/images/:id/raw`：读取图片元数据或私有图片内容
- `GET /api/images/usage`：读取用户图片存储统计

权威存储为 PostgreSQL + MinIO/S3，浏览器 IndexedDB 只适合作为本地缓存。详见 [图片 API 文档](docs/backend-image-api.md) 与 [MinIO 当前实现说明](docs/backend-minio-plan.md)。

## 常用命令

```bash
# 前端构建
npm run build

# 前端生产启动
npm run start

# 后端类型检查
npm run lint --prefix backend

# 后端构建
npm run build --prefix backend

# 后端生产迁移
npm run prisma:deploy --prefix backend

# 生成 Prisma Client
npm run prisma:generate --prefix backend

# 执行 Prisma 迁移
npm run prisma:migrate --prefix backend
```

> 根目录 `npm run lint` 当前对应 `next lint`。如果使用的 Next.js 版本不再提供该命令，请以项目当前工具链为准调整。

## 生产部署

项目提供生产编排示例：

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

也提供自动发布脚本（前后端双容器）：

```bash
# 1) 在服务器上执行（仓库已在服务器）
chmod +x scripts/deploy-prod.sh
./scripts/deploy-prod.sh

# 2) 在本地一键发到远端服务器并发布
chmod +x scripts/deploy-remote.sh
./scripts/deploy-remote.sh --password '<your_ssh_password>'
```

常用可选参数：

```bash
# 跳过数据库迁移
./scripts/deploy-prod.sh --skip-migrate

# 本地发版时指定远端目录和主机
./scripts/deploy-remote.sh \
  --host 43.155.204.215 \
  --user root \
  --remote-dir /opt/chatty \
  --password '<your_ssh_password>'
```

默认服务：

- `chatty-backend`：后端服务，容器端口 `3001`
- `chatty-frontend`：Web 前端，宿主机端口 `18080` 映射到容器端口 `3000`

部署前请确认：

- `backend/.env` 已配置生产环境变量。
- `docker-compose.prod.yml` 中的 `APP_ORIGIN`、`NEXT_PUBLIC_API_BASE_URL`、网络名和端口符合部署环境。
- Sub2API、PostgreSQL、Redis、MinIO/S3 与微信平台配置均可访问。
- Casdoor、SMTP、微信开放平台/公众号配置与 `APP_ORIGIN`、回调域名一致。

项目还包含 `nginx.conf`，其中 `/api/*` 会反向代理到 `chatty-backend:3001`，并关闭代理缓冲以支持 SSE 流式聊天。

## 相关文档

- [后端说明](backend/README.md)
- [图片 API 文档](docs/backend-image-api.md)
- [MinIO 当前实现说明](docs/backend-minio-plan.md)
- [后端配置清单](backend/CONFIG_CHECKLIST.md)
- [前端重构设计规范](docs/Chatty-Redesign/设计规范.md)

## 验证建议

提交或部署前建议至少执行：

```bash
npm run build
npm run lint --prefix backend
npm run build --prefix backend
```

如果改动涉及数据库 schema，请同时执行：

```bash
npm run prisma:generate --prefix backend
npm run prisma:migrate --prefix backend
```

## English Quick Reference

This repository is maintained with Chinese as the primary documentation language. For implementation details, use the Chinese sections above and these linked docs:

- [Main README, Chinese](#chatty--万模ai)
- [Backend README](backend/README.md)
- [Image API documentation](docs/backend-image-api.md)
- [MinIO integration plan](docs/backend-minio-plan.md)

Chatty / Wanmo AI is a full-stack multi-model AI application with a Next.js web app, a NestJS backend, and a WeChat Mini Program. It supports multi-model chat, image generation, user authentication, unified points and redemption workflows, rewarded ads, admin management, and Sub2API-based model gateway integration.

Quick start:

```bash
npm install
npm install --prefix backend
cp backend/.env.example backend/.env
npm run prisma:generate --prefix backend
npm run prisma:migrate --prefix backend
npm run seed --prefix backend
npm run dev
```

Default local URLs:

- Web: `http://localhost:3000`
- API: `http://localhost:3001/api`
