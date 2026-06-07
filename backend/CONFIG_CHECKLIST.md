# Chatty Backend 配置清单

这个文件可以提交到代码仓库，只记录配置项和操作步骤，不记录真实密钥、公网地址、账号或密码。

> 最后更新：2026-06-07。清单按当前 `backend/.env.example` 整理。

## 本地私有配置

后端真实配置放在：

```text
backend/.env
```

小程序真实本地配置放在：

```text
miniprogram/utils/config.local.js
miniprogram/project.private.config.json
```

这些文件已加入忽略规则或由微信开发者工具按本机生成，不要提交。

## 必填环境变量

复制示例文件后补齐真实值：

```bash
cd backend
cp .env.example .env
```

需要根据环境填写：

```text
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
CASDOOR_STATE_SECRET
CASDOOR_ORGANIZATION
CASDOOR_APPLICATION_NAME
WECHAT_MINIAPP_APP_ID
WECHAT_MINIAPP_APP_SECRET
WECHAT_MINIAPP_ENV_VERSION
WECHAT_REWARDED_VIDEO_AD_UNIT_ID
WECHAT_OPEN_APP_ID
WECHAT_OPEN_APP_SECRET
WECHAT_OPEN_REDIRECT_URI
WECHAT_OFFIACCOUNT_APP_ID
WECHAT_OFFIACCOUNT_APP_SECRET
SUB2API_BASE_URL
SUB2API_GATEWAY_API_KEY
SUB2API_IMAGE_GATEWAY_API_KEY
POINT_PRICE_CHAT
POINT_PRICE_IMAGE_GENERATION
POINT_PRICE_IMAGE_EDIT
MINIO_ENDPOINT
MINIO_PUBLIC_ENDPOINT
MINIO_REGION
MINIO_ACCESS_KEY
MINIO_SECRET_KEY
MINIO_BUCKET
MINIO_FORCE_PATH_STYLE
IMAGE_BACKEND
IMAGE_PRESIGN_TTL_SECONDS
IMAGE_UPLOAD_MAX_BYTES
DEFAULT_ADMIN_EMAIL
DEFAULT_ADMIN_PASSWORD
SMTP_HOST
SMTP_PORT
SMTP_SECURE
SMTP_USER
SMTP_PASS
SMTP_FROM
```

网页登录二维码默认跳转小程序正式版：

```text
WECHAT_MINIAPP_ENV_VERSION=release
```

可选值只有 `release`、`trial`、`develop`。需要测试体验版时才临时改成 `trial`。

## 统一登录配置

Casdoor 已接入为统一身份源：

```text
CASDOOR_AUTH_REQUIRED=false
```

- `false`：前端仍展示邮箱密码、微信 Web/H5、扫码等入口，并额外展示 Casdoor。
- `true`：隐藏并禁用本地/微信网页登录入口，只允许 Casdoor。

Casdoor 回调地址必须同时满足：

- `CASDOOR_REDIRECT_URI` 与后端实际公网地址一致。
- Casdoor 应用后台登记的 Redirect URI 完全匹配。
- `CASDOOR_ADMIN_MATCHERS`、`CASDOOR_OWNER_MATCHERS` 命中 userinfo 中的 `sub/id/name/email/phone/roles/groups/permissions` 任一值时，才授予后台权限。

## 邮件验证码配置

邮箱注册、找回密码、绑定邮箱依赖 SMTP：

```text
SMTP_HOST
SMTP_PORT
SMTP_SECURE
SMTP_USER
SMTP_PASS
SMTP_FROM
EMAIL_VERIFICATION_TTL_SECONDS
EMAIL_VERIFICATION_RESEND_INTERVAL_SECONDS
EMAIL_VERIFICATION_IP_HOURLY_LIMIT
EMAIL_VERIFICATION_MAX_ATTEMPTS
```

生产环境必须确认发信域名 SPF/DKIM/DMARC，避免验证码邮件进垃圾箱。

## 图片与对象存储配置

当前图片上传、生成结果和任务历史以 PostgreSQL + MinIO/S3 为权威存储：

```text
IMAGE_BACKEND=minio
MINIO_ENDPOINT
MINIO_PUBLIC_ENDPOINT
MINIO_ACCESS_KEY
MINIO_SECRET_KEY
MINIO_BUCKET
IMAGE_PRESIGN_TTL_SECONDS
IMAGE_UPLOAD_MAX_BYTES
```

Bucket 建议保持私有。不要把 `MINIO_ACCESS_KEY`、`MINIO_SECRET_KEY` 放进前端环境变量或小程序配置。

## 小程序本地配置

复制本地覆盖文件：

```bash
cp miniprogram/utils/config.local.example.js miniprogram/utils/config.local.js
```

然后填写：

```text
BASE_URL
WECHAT_APP_ID
REWARDED_VIDEO_AD_UNIT_ID
```

`project.config.json` 保持可提交的空 AppID 模板。开发者工具里选择实际 AppID 时，让它写入本机私有配置。

## 本地启动命令

```bash
cd backend
npm run prisma:generate
npm run prisma:migrate
npm run seed
npm run dev
```

如果只是检查 TypeScript 构建：

```bash
cd backend
npm run build
```

## 提交前检查

```bash
git status --short
rg -n "sk-[A-Za-z0-9]|admin@|PASSWORD=.+|SECRET=.+|postgresql://.*@|[0-9]+\\.[0-9]+\\.[0-9]+\\.[0-9]+" .
```

如果命中真实密钥、账号、密码或公网地址，先移到 `.env` / `config.local.js`，再提交。
