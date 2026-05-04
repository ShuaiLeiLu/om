# Chatty / 万模AI 后端 PRD

版本：v1.0  
日期：2026-05-04  
面向读者：产品负责人、AI 编程代理、后端工程师、前端工程师、运维人员

## 1. 一句话说明

Chatty 后端是万模AI自己的业务中台。它负责用户登录、微信身份、token 额度、兑换码、广告奖励、聊天记录、模型调用代理、Sub2API 用量同步、管理后台和部署运维。

普通用户不使用邮箱密码登录。普通用户 Web 端使用微信扫码登录，小程序只做广告领 Token 和余额查看；两端通过同一微信身份绑定到同一个 Chatty 用户。管理员后台单独使用账号密码登录。

## 2. 背景

当前 Chatty 前端已经可以选择不同模型并发起聊天，但存在几个不适合商业化的问题：

1. 前端直接请求模型代理路径，例如 `/openai-api/*`、`/gemini-api/*`、`/nvidia-api/*`。
2. 模型 API Key 曾经出现在客户端配置中，这会导致密钥泄露和费用不可控。
3. 聊天记录主要存在浏览器本地，换设备、清缓存、多人使用时不可控。
4. token usage 即使由上游或 Sub2API 返回，前端现在也没有可靠保存和扣费体系。
5. 没有用户体系、套餐、兑换码、额度、流水、后台管理。
6. 后续要做微信小程序看广告增加 token，需要一个可信后端负责发放和防刷。

因此必须新增自有后端。Sub2API 继续作为模型网关和 usage 统计来源，Chatty 后端负责业务和账务。

## 3. 产品目标

### 3.1 核心目标

建设一个可以支撑内部试运营和后续商业化的后端系统。

后端必须做到：

- 普通用户 Web 端使用微信扫码登录，不使用邮箱密码。
- 用户在小程序和 Web 使用同一个 Chatty 账号。
- 前端不再保存任何模型 API Key。
- AI 聊天请求必须经过 Chatty 后端。
- Chatty 后端调用 Sub2API，再由 Sub2API 调用各模型。
- Sub2API usage 同步到 Chatty 后端。
- 用户 token 余额由 Chatty 后端计算和展示。
- 每一笔 token 增加和消耗都有流水。
- 管理员能管理用户、模型、套餐、兑换码、用量和广告奖励。
- 后端可部署到现有腾讯云 Docker 环境。

### 3.2 非目标

v1 不做以下功能：

- 普通用户邮箱密码登录。
- 普通用户自由注册。
- 微信支付。
- 在线购买套餐。
- 发票。
- 团队空间。
- 企业组织。
- 小程序内完整 AI 聊天。
- 用户自带 API Key。
- 邀请返利。
- 复杂会员等级。

## 4. 用户角色

### 4.1 普通用户

普通用户通过微信扫码登录 Web。

普通用户可以：

- 使用微信扫码登录 Web。
- 在 Web 使用 AI 聊天。
- 在小程序查看 token 余额。
- 在小程序看广告领取 token。
- 在 Web 使用兑换码。
- 查看自己的 token 流水。
- 查看自己的聊天记录。
- 退出登录。

普通用户不能：

- 使用邮箱密码登录。
- 查看其他用户数据。
- 查看后台。
- 修改模型价格和模型开关。
- 生成兑换码。
- 调整 token。
- 直接调用 Sub2API。

### 4.2 管理员

管理员后台使用账号密码登录。

管理员可以：

- 查看用户列表。
- 禁用或启用用户。
- 手动调整用户 token。
- 创建套餐。
- 批量生成兑换码。
- 撤销未使用兑换码。
- 查看 token 流水。
- 查看 Sub2API usage。
- 查看模型请求记录。
- 配置模型是否启用。
- 配置广告奖励规则。
- 查看微信绑定关系。
- 解绑异常微信身份。
- 查看系统健康状态。

管理员不能：

- 绕过审计直接改数据库作为常规操作。
- 在后台看到用户完整敏感密钥。
- 在后台看到明文兑换码历史值。

## 5. 总体架构

### 5.1 架构图

```text
用户浏览器 Web
  -> https://aihelp.shuai.help
  -> Caddy
  -> Chatty 前端容器

用户浏览器 Web 调用 /api/*
  -> Caddy
  -> Chatty 后端容器
  -> PostgreSQL
  -> Redis
  -> Sub2API
  -> 上游模型供应商

微信小程序
  -> https://aihelp.shuai.help/api/*
  -> Chatty 后端容器
  -> 微信 code2Session / 小程序码接口
  -> PostgreSQL / Redis
```

### 5.2 现有服务器环境

腾讯云上已经有：

```text
Docker
Docker Compose
Caddy
PostgreSQL
Redis
Sub2API
Chatty 前端容器
MinIO
```

后端需要新增：

```text
chatty-backend 容器
chatty_backend 数据库
后端环境变量
Caddy /api/* 路由
Redis 队列配置
```

### 5.3 技术选型

推荐固定：

```text
后端框架：NestJS
开发语言：TypeScript
数据库：PostgreSQL
ORM：Prisma
队列：Redis + BullMQ
部署：Docker
反向代理：Caddy
模型网关：Sub2API
```

选择理由：

- 前端是 Next/React，后端用 TypeScript 可减少技术栈成本。
- NestJS 适合模块化业务系统。
- PostgreSQL 适合用户、账务流水、usage 记录。
- Prisma 对 AI 编程代理更友好，表结构和类型更清楚。
- Redis + BullMQ 适合做 usage 同步、重试、定时任务。
- Docker 能直接复用现有腾讯云环境。

## 6. 登录与身份体系

### 6.1 普通用户登录方式

普通用户 Web 登录只使用微信扫码登录。

不提供普通用户邮箱密码登录。

这样做的原因：

- 用户 Web 账号和小程序账号可以通过同一微信身份绑定。
- 后续看广告发 token 不需要再处理复杂账号合并。
- 用户在小程序看广告领取 token 后，Web 端马上可使用。
- 微信身份更适合后续运营和风控。

重要边界：

- 小程序 v1.2 不承担 Web 登录确认页。
- 小程序只负责 `wx.login`、广告奖励和余额查看。
- Web 端扫码登录建议使用微信开放平台/网站应用扫码登录能力。
- 如果暂时没有微信开放平台网站应用，可以先保留后端扫码会话能力作为过渡，但不能让小程序产品页变成登录确认工具。

### 6.2 管理员登录方式

管理员后台使用账号密码登录。

管理员账号不等于普通用户账号。管理员账号只用于后台管理。

管理员登录需要：

- 用户名或邮箱。
- 密码。
- 登录失败频控。
- 密码哈希保存。
- 登录审计日志。

后续可以增加管理员微信白名单登录，但 v1 不做。

### 6.3 微信身份字段

微信登录后，后端会从微信拿到：

```text
openid：当前微信应用下的用户唯一标识
unionid：同一微信开放平台主体下的用户统一标识，可能为空
session_key：小程序 code2Session 返回的会话密钥，只后端短暂使用，不返回前端
```

身份匹配优先级：

1. 如果有 `unionid`，优先用 `unionid` 查找用户。
2. 如果没有 `unionid`，使用 `appid + openid` 查找用户。
3. 如果都找不到，首次 Web 微信登录时自动创建 Chatty 用户。

### 6.4 一个微信对应一个用户

规则：

- 一个微信身份只能对应一个 Chatty 用户。
- 一个 Chatty 用户默认只绑定一个微信身份。
- 如果用户需要换绑，必须通过后台或专门换绑流程。
- 管理员可以在后台解绑异常微信身份。

## 7. 微信扫码登录 Web

### 7.1 推荐登录方式

Web 端普通用户登录推荐使用微信开放平台的网页登录能力。

流程：

1. 用户在 Web 登录页点击“微信登录”。
2. Web 展示微信扫码登录二维码，或跳转微信授权页。
3. 用户使用微信扫码确认。
4. 微信回调后端，携带授权 `code`。
5. 后端使用 `code` 换取微信身份。
6. 后端优先使用 `unionid` 查找现有 Chatty 用户。
7. 如果找不到，再使用对应应用的 `appid + openid` 查找。
8. 如果仍然找不到，自动创建 Chatty 用户并写入微信身份绑定。
9. 后端给 Web 写入登录 Cookie。
10. Web 进入 Chatty 聊天页面。

### 7.2 为什么不让小程序承担 Web 登录确认

小程序 v1.2 的产品目标是广告领 Token，不是登录确认工具。

如果把 Web 登录确认页放进小程序，会带来这些问题：

- 小程序页面范围变大，用户打开后会看到与广告领 Token 无关的流程。
- 小程序代码和 PRD 容易变成完整账户中心。
- Web 登录 Cookie 不能直接由小程序响应写入浏览器，仍需要 Web 端轮询或一次性票据。
- 后续审核、测试和用户理解成本都会变高。

因此，v1.2 小程序保持极简；Web 登录用微信开放平台能力解决，两端通过 `unionid` 或绑定表关联。

### 7.3 过渡方案

如果暂时没有微信开放平台网站应用，可以保留“Web 创建扫码会话，小程序扫码确认，Web 轮询”的后端能力作为过渡。

但过渡方案有两个限制：

- 小程序不在首页展示登录确认入口。
- 只有通过二维码 scene 打开小程序时，才进入隐藏的临时确认流程。

这个过渡方案不是小程序 v1.2 的主产品范围。

### 7.4 Web 登录 Cookie

登录成功后，后端写 Cookie。

要求：

- Cookie 必须是 httpOnly。
- 生产环境必须 secure。
- 同域名下使用，减少跨域复杂度。
- Cookie 过期后需要重新扫码登录。

建议：

```text
access session：2 小时
refresh session：14 天
```

如果用户被禁用：

- 已有 session 应失效。
- 新请求应返回未授权或用户已禁用。

## 8. 管理员后台登录

### 8.1 管理员账号

管理员账号字段：

```text
管理员ID
用户名
邮箱
密码哈希
角色：admin / owner
状态：active / disabled
最后登录时间
创建时间
```

### 8.2 管理员接口

```text
POST /api/admin/auth/login
POST /api/admin/auth/logout
GET  /api/admin/me
```

### 8.3 管理员安全要求

- 密码不能明文保存。
- 推荐使用 Argon2id。
- 登录失败 5 次后短暂锁定。
- 后台所有写操作记录审计日志。
- 普通用户 Cookie 不能访问管理员接口。
- 管理员 Cookie 或 token 与普通用户隔离。

## 9. token 额度体系

### 9.1 token 是什么

token 是用户使用 AI 模型的额度单位。

用户可以通过以下方式获得 token：

- 兑换码。
- 小程序看广告奖励。
- 管理员手动赠送。
- 后续付费套餐。

用户调用模型会消耗 token。

### 9.2 token 不等于人民币

v1 用户余额显示 token，不显示人民币余额。

Sub2API 的 cost 用于管理员查看成本，不直接展示给普通用户。

### 9.3 token grant

token grant 是一笔可用 token 权益。

例子：

```text
兑换码获得 100000 tokens，有效期 30 天
广告奖励获得 1000 tokens，有效期 7 天
管理员赠送 50000 tokens，有效期 90 天
```

每笔 grant 都有：

```text
总 token
剩余 token
来源
生效时间
过期时间
状态
```

### 9.4 token 扣减规则

扣减顺序：

1. 只扣未过期、未用完的 grant。
2. 优先扣最早过期的 grant。
3. 如果多个 grant 过期时间相同，先扣创建时间更早的。

如果 token 不足：

- 用户不能发起新的聊天请求。
- 页面提示“token 余额不足，请兑换或领取 token”。

### 9.5 token 流水

所有 token 变化都必须写流水。

流水类型：

```text
redeem_code：兑换码增加
ad_reward：广告奖励增加
manual_adjustment：管理员手动调整
model_usage：模型调用消耗
grant_expired：额度过期
refund：后续退款或补偿，v1 可预留
```

普通用户能看到自己的流水。管理员能看到全部流水。

## 10. 套餐与兑换码

### 10.1 套餐

套餐是兑换码背后的权益模板。

套餐字段：

```text
套餐ID
套餐名称
token额度
有效天数
可用模型范围
状态：active / disabled
备注
创建时间
更新时间
```

例子：

```text
内部体验包：2000000 tokens，有效期 30 天
广告补偿包：50000 tokens，有效期 7 天
测试包：10000 tokens，有效期 3 天
```

### 10.2 兑换码

兑换码用于给用户发放套餐。

规则：

- 管理员批量生成兑换码。
- 兑换码只在生成时明文展示一次。
- 数据库只保存兑换码 hash。
- 兑换码只能使用一次。
- 已使用、已撤销、已过期都不能兑换。
- 兑换成功后创建 token grant。
- 兑换成功后写 token 流水。

### 10.3 用户兑换流程

1. 用户进入 Web 或小程序兑换页。
2. 输入兑换码。
3. 后端校验兑换码。
4. 校验通过后创建 token grant。
5. 写 token 流水。
6. 返回当前余额。

失败提示：

```text
兑换码不存在
兑换码已使用
兑换码已过期
兑换码已撤销
兑换码格式错误
```

## 11. AI 聊天系统

### 11.1 基本原则

前端不能再直接调用模型接口。

禁止前端直接请求：

```text
/openai-api/*
/gemini-api/*
/nvidia-api/*
/grok-api/*
```

前端统一调用：

```text
POST /api/chat/completions
```

### 11.2 聊天请求前检查

后端收到聊天请求后，必须检查：

- 用户是否登录。
- 用户状态是否 active。
- 用户是否有可用 token。
- 模型是否存在。
- 模型是否启用。
- 用户是否有权限使用该模型。
- Sub2API 是否可用。

任何检查失败，都不能调用 Sub2API。

### 11.3 流式输出

聊天回复必须支持流式输出。

Web 前端应能像 ChatGPT 一样逐字或分段显示回复。

后端使用 SSE 返回事件。

事件类型：

```text
message.delta：回复增量内容
message.done：回复完成
message.error：出错
```

### 11.4 聊天记录保存

后端必须保存：

- 用户消息。
- 助手回复。
- 模型 ID。
- 会话 ID。
- 请求 ID。
- 请求状态。
- 错误原因。
- 创建时间。

如果用户中断：

- 保存已经生成的助手内容。
- 请求状态标记为 cancelled。

如果模型失败：

- 保存用户消息。
- 保存失败状态。
- 保存错误原因。

### 11.5 会话标题

v1 可以简单处理：

- 新会话默认标题为用户第一条消息的前 20 个字符。
- 如果没有文本，标题为“新对话”。

后续可以用 AI 自动总结标题。

## 12. Sub2API 集成

### 12.1 Sub2API 的职责

Sub2API 负责：

- 保存上游模型供应商 Key。
- 转发模型请求。
- 记录 prompt tokens。
- 记录 completion tokens。
- 记录 total tokens。
- 记录成本 cost。
- 提供 usage 查询。

### 12.2 Chatty 后端的职责

Chatty 后端负责：

- 校验用户和 token。
- 创建本地 LLM 请求记录。
- 调用 Sub2API。
- 保存聊天消息。
- 定时拉取 Sub2API usage。
- 根据 usage 扣用户 token。
- 记录 token 流水。

### 12.3 usage 同步

需要一个后台任务定时同步 usage。

默认：

```text
每 1 分钟同步一次
```

同步流程：

1. 读取上次同步游标。
2. 调用 Sub2API usage 接口。
3. 拉取新增 usage。
4. 写入 `usage_events`。
5. 查找对应 `llm_requests`。
6. 按 total tokens 扣用户 token。
7. 写 `quota_ledger`。
8. 更新同步游标。

### 12.4 幂等要求

幂等是必须的。

要求：

- 同一条 Sub2API usage 只能写入一次。
- 同一条 usage 只能扣 token 一次。
- 同步任务失败重试不能重复扣费。
- 手动触发同步不能重复扣费。

### 12.5 usage 无法匹配请求时

如果某条 usage 暂时匹配不到本地请求：

- 仍然保存 usage_events。
- 状态标记为 unmatched。
- 后台展示为待处理。
- 不立即扣用户 token。
- 后续通过用户 key、时间、模型、request id 尝试匹配。

如果长期无法匹配：

- 管理员后台提示。
- 管理员可手动关联或忽略。

## 13. 模型管理

### 13.1 模型字段

```text
模型ID
供应商
显示名称
Sub2API模型名
是否启用
是否允许普通用户使用
排序
备注
创建时间
更新时间
```

### 13.2 规则

- 前端模型列表由后端返回。
- 停用模型不能发起新聊天。
- 管理员可在后台启用或停用模型。
- 历史消息中的模型名称不因模型停用而消失。

### 13.3 模型默认展示

v1 可展示现有前端已有供应商：

```text
OpenAI
Gemini
DeepSeek
Qwen
Moonshot
Grok
智谱
```

实际可用模型以 Sub2API 配置和管理员启用状态为准。

## 14. 微信小程序相关后端

### 14.1 小程序配置

后端环境变量：

```text
WECHAT_MINIAPP_APP_ID
WECHAT_MINIAPP_APP_SECRET
WECHAT_MINIAPP_ENV_VERSION
WECHAT_MINIAPP_PAGE_PATH
WECHAT_REWARDED_VIDEO_AD_UNIT_ID
```

注意：

- AppSecret 只能存在后端。
- 不能写进前端。
- 不能写进小程序代码。
- 不能提交到 Git。

### 14.2 小程序登录接口

```text
POST /api/wechat/miniapp/auth/login
```

入参：

```json
{
  "code": "wx.login 返回的 code"
}
```

返回：

```json
{
  "miniappSessionToken": "小程序会话",
  "user": {
    "id": "用户ID",
    "nickname": "昵称",
    "bound": true,
    "tokenBalance": 100000
  }
}
```

### 14.3 小程序当前用户接口

```text
GET /api/wechat/miniapp/me
```

返回：

- 微信身份是否已登录。
- 是否已经绑定 Chatty 用户。
- token 余额。
- 今日广告奖励剩余次数。

## 15. 微信扫码登录接口

本章接口属于 Web 微信登录能力。

推荐优先接入微信开放平台网页登录。如果没有微信开放平台网站应用，这些接口可以作为临时过渡方案。小程序 v1.2 首页不使用这些接口。

### 15.1 创建扫码登录会话

```text
POST /api/auth/wechat-miniapp/sessions
```

用途：

- Web 登录页创建扫码登录二维码。

入参：

```json
{
  "mode": "login"
}
```

返回：

```json
{
  "sessionId": "登录会话ID",
  "scene": "小程序码scene",
  "qrImageUrl": "二维码图片地址或base64",
  "expiresAt": "过期时间"
}
```

### 15.2 查询扫码登录状态

```text
GET /api/auth/wechat-miniapp/sessions/:sessionId
```

返回：

```json
{
  "status": "pending | scanned | confirmed | expired | cancelled",
  "message": "状态说明"
}
```

### 15.3 小程序扫码上报

```text
POST /api/wechat/miniapp/sessions/scan
```

用途：

- 小程序扫码后告诉后端“我扫了这个二维码”。
- 仅作为过渡登录方案使用，小程序 v1.2 首页不调用。

### 15.4 小程序确认登录

```text
POST /api/wechat/miniapp/sessions/confirm
```

用途：

- 用户点击确认登录后调用。
- 仅作为过渡登录方案使用，小程序 v1.2 首页不调用。

确认后：

- Web 轮询状态变为 confirmed。
- Web 获得登录 Cookie。

## 16. 广告奖励 token 后端

### 16.1 基本规则

用户在小程序看激励视频广告，可以获得 token。

奖励规则由后台配置。

默认值：

```text
每次奖励：1000 tokens
每日上限：5 次
奖励有效期：7 天
最小领取间隔：30 秒
奖励会话有效期：5 分钟
```

### 16.2 为什么要两段式

不能让小程序前端直接告诉后端“我看完广告了，给我 token”。

因为前端请求可能被伪造。

所以必须两段式：

1. 后端创建 reward session。
2. 小程序播放广告。
3. 小程序确认完整观看后 claim。
4. 后端校验 reward session 是否有效、是否已使用、是否超限。
5. 通过后才发 token。

### 16.3 接口

获取奖励配置：

```text
GET /api/wechat/miniapp/rewards/config
```

创建奖励会话：

```text
POST /api/wechat/miniapp/rewards/sessions
```

领取奖励：

```text
POST /api/wechat/miniapp/rewards/claim
```

### 16.4 防刷规则

必须实现：

- 未登录小程序不能领取。
- 未绑定 Chatty 用户不能领取。
- rewardSessionId 只能使用一次。
- rewardSessionId 过期不能使用。
- 每日超过上限不能领取。
- 低于最小领取间隔不能领取。
- 重复 claim 不能重复加 token。
- 每次 claim 记录 IP、UA、openid、userId、结果和错误码。

### 16.5 广告奖励入账

领取成功后：

1. 创建 token grant。
2. 来源为 `ad_reward`。
3. 写 quota ledger。
4. 返回最新 token 余额。

## 17. 管理后台

### 17.1 后台页面

后台需要支持：

```text
登录页
仪表盘
用户管理
套餐管理
兑换码管理
模型管理
聊天请求记录
Sub2API usage 记录
token 流水
微信身份绑定
广告奖励配置
广告奖励流水
系统健康状态
管理员审计日志
```

### 17.2 仪表盘指标

后台首页展示：

```text
总用户数
今日新增用户
今日活跃用户
今日聊天请求数
今日消耗 tokens
今日广告发放 tokens
今日兑换 tokens
今日 Sub2API 成本
usage 同步状态
失败请求数
```

### 17.3 管理员操作审计

以下操作必须写审计日志：

- 登录后台。
- 创建用户。
- 禁用用户。
- 手动调整 token。
- 创建套餐。
- 生成兑换码。
- 撤销兑换码。
- 修改模型开关。
- 修改广告奖励配置。
- 解绑微信。
- 手动同步 Sub2API usage。

审计日志包含：

```text
操作人
操作类型
操作对象
操作前数据
操作后数据
IP
UA
时间
```

## 18. 数据表设计

### 18.1 users

普通用户表。

字段：

```text
id
display_name
avatar_url
status：active / disabled
created_at
updated_at
last_login_at
```

说明：

- 普通用户不需要邮箱密码字段。
- 用户主要通过微信身份关联。

### 18.2 admin_users

管理员账号表。

字段：

```text
id
username
email
password_hash
role：admin / owner
status
last_login_at
created_at
updated_at
```

### 18.3 oauth_accounts

微信身份绑定表。

字段：

```text
id
user_id
provider：wechat_miniapp
appid
openid
unionid
nickname
avatar_url
bound_at
last_login_at
created_at
updated_at
```

唯一约束：

```text
provider + appid + openid 唯一
unionid 非空时 unionid 唯一
```

### 18.4 user_sessions

Web 普通用户 session 表。

字段：

```text
id
user_id
refresh_token_hash
status
expires_at
created_at
revoked_at
ip
user_agent
```

### 18.5 wechat_qr_sessions

微信扫码登录会话表。

字段：

```text
id
session_id
mode：login
scene
status
user_id
openid
unionid
expires_at
scanned_at
confirmed_at
created_at
```

### 18.6 wechat_miniapp_sessions

小程序 session 表。

字段：

```text
id
session_token_hash
openid
unionid
user_id
expires_at
created_at
revoked_at
```

### 18.7 plans

套餐表。

字段：

```text
id
name
token_amount
valid_days
model_scope
status
remark
created_at
updated_at
```

### 18.8 redeem_codes

兑换码表。

字段：

```text
id
code_hash
plan_id
status
expires_at
used_by_user_id
used_at
created_by_admin_id
created_at
revoked_at
```

### 18.9 token_grants

token 权益表。

字段：

```text
id
user_id
source：redeem_code / ad_reward / manual_adjustment
source_id
total_tokens
remaining_tokens
starts_at
expires_at
status
created_at
updated_at
```

### 18.10 quota_ledger

token 流水表。

字段：

```text
id
user_id
grant_id
type
delta_tokens
balance_after
related_id
remark
created_at
```

### 18.11 conversations

会话表。

字段：

```text
id
user_id
title
default_model_id
status
created_at
updated_at
```

### 18.12 messages

消息表。

字段：

```text
id
conversation_id
user_id
role：user / assistant / system
content
images_json
model_id
status
created_at
updated_at
```

### 18.13 llm_requests

模型请求表。

字段：

```text
id
request_id
user_id
conversation_id
model_id
sub2api_request_id
status
error_message
started_at
completed_at
created_at
```

### 18.14 usage_events

Sub2API usage 表。

字段：

```text
id
sub2api_usage_id
llm_request_id
user_id
model_id
prompt_tokens
completion_tokens
total_tokens
cost
raw_json
status：matched / unmatched / charged / ignored
synced_at
created_at
```

### 18.15 models

模型表。

字段：

```text
id
provider
display_name
sub2api_model
enabled
sort_order
remark
created_at
updated_at
```

### 18.16 ad_reward_config

广告奖励配置表。

字段：

```text
id
enabled
ad_unit_id
reward_tokens
daily_limit_per_user
reward_token_valid_days
min_interval_seconds
session_ttl_seconds
updated_by_admin_id
updated_at
```

### 18.17 ad_reward_sessions

广告奖励会话表。

字段：

```text
id
reward_session_id
user_id
openid
ad_unit_id
reward_tokens
status：pending / granted / expired / rejected
expires_at
granted_at
created_at
```

### 18.18 ad_reward_events

广告奖励审计表。

字段：

```text
id
reward_session_id
user_id
openid
event_type
result
error_code
ip
user_agent
created_at
```

### 18.19 sync_state

同步状态表。

字段：

```text
id
name
cursor
last_success_at
last_error
updated_at
```

### 18.20 admin_audit_logs

后台审计日志表。

字段：

```text
id
admin_user_id
action
target_type
target_id
before_json
after_json
ip
user_agent
created_at
```

## 19. API 清单

### 19.1 普通 Web 用户

```text
POST /api/auth/wechat-miniapp/sessions
GET  /api/auth/wechat-miniapp/sessions/:sessionId
POST /api/auth/logout
GET  /api/me
GET  /api/models
GET  /api/quota/summary
GET  /api/quota/ledger
POST /api/redeem
GET  /api/conversations
POST /api/conversations
GET  /api/conversations/:id/messages
POST /api/chat/completions
```

### 19.2 微信小程序

```text
POST /api/wechat/miniapp/auth/login
GET  /api/wechat/miniapp/me
GET  /api/wechat/miniapp/rewards/config
POST /api/wechat/miniapp/rewards/sessions
POST /api/wechat/miniapp/rewards/claim
```

小程序 v1.2 不调用兑换码、流水、扫码确认接口。

### 19.3 管理后台

```text
POST /api/admin/auth/login
POST /api/admin/auth/logout
GET  /api/admin/me
GET  /api/admin/dashboard
GET  /api/admin/users
PATCH /api/admin/users/:id
POST /api/admin/users/:id/disable
POST /api/admin/users/:id/enable
POST /api/admin/users/:id/quota-adjust
GET  /api/admin/plans
POST /api/admin/plans
PATCH /api/admin/plans/:id
POST /api/admin/redeem-codes/batch
GET  /api/admin/redeem-codes
POST /api/admin/redeem-codes/:id/revoke
GET  /api/admin/models
PATCH /api/admin/models/:id
GET  /api/admin/usage-events
GET  /api/admin/llm-requests
GET  /api/admin/quota-ledger
GET  /api/admin/wechat/accounts
POST /api/admin/wechat/accounts/:id/unbind
GET  /api/admin/wechat/reward-config
PATCH /api/admin/wechat/reward-config
GET  /api/admin/wechat/reward-events
POST /api/admin/sub2api/sync
GET  /api/admin/sub2api/sync-status
GET  /api/admin/system/health
GET  /api/admin/audit-logs
```

## 20. 错误码

建议统一错误码，方便前端和小程序显示。

```text
unauthorized：未登录
forbidden：无权限
user_disabled：用户已禁用
wechat_code_invalid：微信登录 code 无效
qr_session_expired：二维码已过期
qr_session_not_found：二维码不存在
token_insufficient：token 不足
model_disabled：模型已停用
redeem_code_invalid：兑换码无效
redeem_code_used：兑换码已使用
redeem_code_expired：兑换码已过期
reward_disabled：广告奖励未开启
reward_daily_limit：今日领取次数已达上限
reward_session_expired：奖励会话已过期
reward_session_consumed：奖励已领取
sub2api_unavailable：模型网关不可用
usage_sync_failed：用量同步失败
```

## 21. 安全要求

必须做到：

- 模型 API Key 不能出现在前端。
- 微信 AppSecret 不能出现在前端或小程序包。
- 数据库密码不能写进代码。
- 管理接口必须校验管理员权限。
- Cookie 使用 httpOnly。
- 生产 Cookie 使用 secure。
- 管理员密码不能明文保存。
- 兑换码不能明文长期保存。
- token 扣减必须幂等。
- Sub2API usage 同步必须幂等。
- 后台关键操作必须写审计日志。
- 登录、扫码、广告 claim 要做频控。

建议做到：

- Postgres 和 Redis 不对公网开放。
- Caddy 只暴露 80/443。
- 后端容器不直接暴露公网端口。
- 所有日志不能打印密钥。
- 敏感环境变量只存在服务器 `.env`。

## 22. 部署方案

### 22.1 Docker 服务

新增服务：

```text
chatty-backend
```

后端容器内部端口：

```text
3001
```

不直接暴露公网，由 Caddy 反代。

### 22.2 Caddy 路由

在 `aihelp.shuai.help` 中新增：

```text
/api/* -> chatty-backend:3001
其他路径 -> chatty 前端容器
```

### 22.3 环境变量

后端需要：

```text
NODE_ENV
APP_ORIGIN
DATABASE_URL
REDIS_URL
COOKIE_SECRET
ADMIN_SESSION_SECRET
WECHAT_MINIAPP_APP_ID
WECHAT_MINIAPP_APP_SECRET
WECHAT_MINIAPP_PAGE_PATH
WECHAT_MINIAPP_ENV_VERSION
WECHAT_REWARDED_VIDEO_AD_UNIT_ID
SUB2API_BASE_URL
SUB2API_ADMIN_EMAIL
SUB2API_ADMIN_PASSWORD
SUB2API_USAGE_SYNC_INTERVAL_SECONDS
```

不要把真实值写入代码仓库。

### 22.4 健康检查

接口：

```text
GET /api/health
```

返回：

```text
后端是否正常
数据库是否正常
Redis 是否正常
Sub2API 是否正常
当前版本
当前时间
```

## 23. 开发阶段计划

### 阶段 1：后端基础

目标：

- 新建 NestJS 后端。
- 接入 PostgreSQL。
- 接入 Redis。
- 接入 Prisma。
- 提供健康检查。
- Docker 能启动。

验收：

- `/api/health` 正常。
- 数据库迁移成功。
- 后端容器可运行。

### 阶段 2：微信身份与 Web 扫码登录

目标：

- 实现小程序 `code2Session`。
- 实现小程序 session。
- 实现 Web 微信扫码登录。
- 实现首次 Web 微信登录自动创建用户。
- 实现 Web 登录 Cookie。
- 实现 Web 用户和小程序用户基于微信身份绑定到同一 Chatty 用户。

验收：

- Web 能完成微信扫码登录。
- Web 登录后能写入 httpOnly Cookie。
- 同一个微信在 Web 和小程序侧识别为同一用户。
- 同一微信不会重复创建多个用户。

### 阶段 3：管理员后台登录

目标：

- 实现管理员账号密码登录。
- 实现管理员权限中间件。
- 实现后台审计日志基础能力。

验收：

- 管理员能登录后台。
- 普通用户不能访问后台接口。

### 阶段 4：token、套餐、兑换码

目标：

- 实现 token grant。
- 实现 quota ledger。
- 实现套餐。
- 实现兑换码。
- 实现用户兑换。

验收：

- 管理员能生成兑换码。
- 用户能兑换。
- 兑换成功增加 token。
- 重复兑换失败。

### 阶段 5：聊天代理与服务端记录

目标：

- 前端聊天请求改走后端。
- 后端调用 Sub2API。
- 支持 SSE 流式输出。
- 保存会话和消息。

验收：

- 用户能流式聊天。
- 数据库保存消息。
- 无 token 用户不能聊天。
- 前端不再请求旧模型代理路径。

### 阶段 6：Sub2API usage 同步与扣 token

目标：

- 定时同步 Sub2API usage。
- 写 usage_events。
- 匹配 llm_requests。
- 扣 token。
- 写 quota_ledger。

验收：

- 聊天后 usage 能同步。
- token 会减少。
- 重复同步不重复扣 token。

### 阶段 7：广告奖励 token

目标：

- 实现广告奖励配置。
- 实现 reward session。
- 实现 claim。
- 实现防刷和幂等。

验收：

- 小程序看广告后 token 增加。
- 达到每日上限后不能领取。
- 重复 claim 不重复发 token。

### 阶段 8：管理后台完整接口

目标：

- 用户管理。
- 套餐管理。
- 兑换码管理。
- 模型管理。
- usage 查看。
- token 流水查看。
- 微信绑定查看。
- 广告配置。
- 系统健康。

验收：

- 管理员可完成日常运营操作。

## 24. 测试验收清单

必须测试：

- Web 微信扫码登录成功。
- 首次微信登录自动创建用户。
- 同一微信重复登录不重复创建用户。
- 微信登录失败时不能创建 Web 会话。
- 管理员账号密码登录成功。
- 普通用户不能访问后台。
- 管理员创建套餐。
- 管理员生成兑换码。
- 用户兑换成功。
- 重复兑换失败。
- token 余额展示正确。
- 有 token 用户能聊天。
- 无 token 用户不能聊天。
- 聊天消息保存成功。
- Sub2API usage 同步成功。
- usage 重复同步不重复扣 token。
- 广告奖励配置生效。
- 小程序看广告后 token 增加。
- 广告奖励达到每日上限后失败。
- reward session 过期后 claim 失败。
- 后台审计日志写入。
- 敏感密钥不出现在前端包和小程序包。

## 25. 上线检查清单

上线前确认：

- 后端环境变量齐全。
- 数据库已迁移。
- Redis 可连接。
- Sub2API 可连接。
- Caddy `/api/*` 路由正确。
- 微信小程序合法域名配置为 `https://aihelp.shuai.help`。
- 微信 AppSecret 未提交到代码仓库。
- 模型 API Key 未出现在前端。
- Postgres 和 Redis 安全组已收紧。
- 管理员初始账号已创建。
- 广告奖励默认关闭，等小程序审核通过后再开启。

## 26. 后续版本

v1.1 可做：

- 小程序内轻量 AI 聊天。
- 微信支付购买 token。
- 邀请奖励。
- 更细的模型权限。
- 用户画像和运营分析。
- 更强广告防刷。
- 管理员微信登录。

v1.2 可做：

- 团队空间。
- 企业账号。
- 发票。
- 套餐订阅。
- API 开放平台。
