# Chatty Backend 配置清单

这个文件可以提交到代码仓库，只记录配置项和操作步骤，不记录真实密钥、公网地址、账号或密码。

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
WECHAT_MINIAPP_APP_ID
WECHAT_MINIAPP_APP_SECRET
WECHAT_MINIAPP_ENV_VERSION
WECHAT_REWARDED_VIDEO_AD_UNIT_ID
SUB2API_BASE_URL
SUB2API_GATEWAY_API_KEY
SUB2API_IMAGE_GATEWAY_API_KEY
DEFAULT_ADMIN_EMAIL
DEFAULT_ADMIN_PASSWORD
```

网页登录二维码默认跳转小程序正式版：

```text
WECHAT_MINIAPP_ENV_VERSION=release
```

可选值只有 `release`、`trial`、`develop`。需要测试体验版时才临时改成 `trial`。

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
