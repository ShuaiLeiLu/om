# Chatty / 万模AI 小程序 PRD

版本：v1.2  
日期：2026-05-04  
定位：微信广告换取 AI Token 的轻量工具页

## 1. 核心结论

小程序只做一个核心功能：**用户观看微信激励视频广告，完整观看后获得 Chatty / 万模AI Token**。

小程序最多附带一个辅助功能：**查看当前 Token 余额**。

小程序必须有后端账号绑定能力，但这个绑定应尽量无感完成：用户打开小程序后，通过 `wx.login` 获取微信身份，后端用 `openid/unionid` 查找或创建 Chatty 用户，并把小程序 session 绑定到这个用户。

除此之外，小程序 v1.2 不做完整账户中心，不做聊天，不做兑换码，不做流水列表，不做客服页，不做帮助长页，也不做 Web 登录确认页。

## 2. 产品边界

### 2.1 小程序要做

- 微信自动登录。
- 微信身份和 Chatty 后端账号自动绑定。
- 查询当前用户 Token 余额。
- 查询今日广告奖励配置。
- 播放微信激励视频广告。
- 完整观看广告后向后端领取 Token。
- 展示今日剩余领取次数。
- 展示领取成功、失败、今日已领完等状态。

### 2.2 小程序不做

- 不做小程序内 AI 聊天。
- 不做兑换码输入。
- 不做 Token 明细列表。
- 不做个人中心。
- 不做客服页。
- 不做帮助与规则长页。
- 不做用户协议独立页。
- 不做会员体系。
- 不做邀请奖励。
- 不做任务中心。
- 不做 Web 扫码登录确认页。
- 不做邮箱登录。
- 不做复杂手动绑定流程。

如果后端或 Web 端需要微信扫码登录，那属于 Web 登录链路，不属于这个小程序 v1.2 的可见产品范围。小程序只需要保证自己能把微信用户绑定到后端 Chatty 用户。

## 3. 用户目标

用户打开小程序后，只需要完成两件事：

1. 看一眼自己还剩多少 Token。
2. 点击按钮看广告领取 Token。

用户不应该在小程序里看到一堆入口，也不应该被引导去理解复杂账户体系。

## 4. 首页信息架构

小程序只注册两个页面：

```text
pages/index/index
pages/error/error
```

首页 `pages/index/index` 展示：

- 品牌名：`万模AI`
- 页面说明：`看广告领取 AI Token`
- 当前 Token 余额。
- 今日还可领取次数。
- 单次广告奖励 Token 数量。
- 主按钮：`看广告领取 Token`
- 三条极简规则。

错误页 `pages/error/error` 只用于网络异常或不可恢复错误兜底。

## 5. 首页示例文案

```text
万模AI
看广告领取 AI Token

当前 Token
123456
今日还可领取 3 次

今日奖励
+1000 tokens / 次
完整观看激励视频后发放，可用于网页版 AI 对话。

[看广告领取 Token]

每日领取次数由活动规则决定。
中途关闭广告不会发放 Token。
Token 余额以服务器记录为准。
```

## 6. 关键流程

### 6.1 首次打开

1. 小程序启动。
2. 调用 `wx.login` 获取临时 code。
3. 小程序把 code 发给后端。
4. 后端调用微信 `code2Session`。
5. 后端拿到 `openid`，如果小程序绑定了微信开放平台，还可能拿到 `unionid`。
6. 后端先用 `provider + appid + openid` 查找是否已经绑定过 Chatty 用户。
7. 如果没有找到，并且有 `unionid`，后端用 `unionid` 查找 Web 端已登录过的同一微信用户。
8. 如果仍然没有找到，后端自动创建一个新的 Chatty 用户。
9. 后端写入 `oauth_accounts` 绑定记录。
10. 后端创建小程序 session，并把 session 绑定到 Chatty 用户。
11. 小程序保存 `miniappSessionToken`。
12. 小程序请求用户余额。
13. 小程序请求广告奖励配置。
14. 首页展示余额、奖励数量和剩余领取次数。

### 6.1.1 为什么小程序没有邮箱登录也能绑定

小程序不需要邮箱密码登录。

绑定依据是微信身份：

```text
微信 openid / unionid
  -> 后端 oauth_accounts 表
  -> Chatty user_id
  -> Token 余额和广告奖励
```

用户打开小程序时，微信已经能通过 `wx.login` 给后端一个可信的登录 code。后端用这个 code 换取微信身份，再把微信身份绑定到 Chatty 用户。

### 6.1.2 绑定策略

后端绑定优先级：

1. 优先用 `wechat_miniapp + appid + openid` 查找已有绑定。
2. 如果没有找到，并且微信返回了 `unionid`，用 `unionid` 查找已有 Chatty 用户。
3. 如果仍然没有找到，创建新的 Chatty 用户。
4. 创建或找到用户后，写入小程序微信绑定。
5. 小程序 session 必须保存 `userId`，后续广告奖励和余额查询都基于这个 `userId`。

这样用户不需要在小程序里输入账号，也不需要邮箱登录。

### 6.1.3 和 Web 账号如何打通

推荐做法：

- Web 端也使用微信登录。
- 小程序和 Web 端都绑定在同一个微信开放平台主体下。
- 后端优先使用 `unionid` 合并同一个微信用户。

如果新小程序暂时拿不到 `unionid`：

- 小程序仍然能自动创建并绑定自己的 Chatty 用户。
- 但 Web 和小程序是否为同一用户，取决于后端是否能拿到相同的 `unionid` 或是否做额外绑定流程。
- 商用正式上线前，建议把 Web 微信登录和小程序都接到同一个微信开放平台账号下，确保 `unionid` 可用。

### 6.2 观看广告领取 Token

1. 用户点击 `看广告领取 Token`。
2. 小程序请求后端创建 `rewardSessionId`。
3. 后端检查用户是否可领取。
4. 后端返回 `rewardSessionId` 和 `adUnitId`。
5. 小程序使用 `wx.createRewardedVideoAd` 播放激励视频广告。
6. 用户完整观看广告。
7. 小程序在广告关闭回调中判断 `isEnded`。
8. 只有完整观看才调用 claim 接口。
9. 后端再次校验 reward session。
10. 后端给用户增加 Token。
11. 后端写入 Token 发放记录和广告领取记录。
12. 小程序弹窗提示领取成功。
13. 小程序刷新余额和剩余领取次数。

### 6.3 中途关闭广告

1. 用户点击广告关闭。
2. 小程序收到广告关闭回调。
3. 如果 `isEnded === false`，不调用后端 claim。
4. 提示：`完整观看后才能领取`。
5. Token 不增加。

### 6.4 今日次数已用完

1. 后端返回 `remainingToday = 0`。
2. 首页按钮置灰。
3. 按钮文案显示：`今日已领完`。
4. 用户不能继续创建广告奖励 session。

## 7. 页面状态

### 7.1 加载中

显示：

```text
正在加载
正在读取你的 Token 信息
```

### 7.2 正常可领取

条件：

- 小程序 session 有效。
- 用户已绑定 Chatty 账号。
- 广告活动已开启。
- 今日剩余领取次数大于 0。

按钮：

```text
看广告领取 Token
```

### 7.3 领取中

条件：

- 已点击按钮。
- 正在创建 reward session、加载广告、播放广告或调用 claim。

按钮：

```text
领取中...
```

按钮禁用，防止重复点击。

### 7.4 用户未绑定

正常情况下，小程序登录时后端会自动绑定或自动创建 Chatty 用户，所以用户不应该长期处于未绑定状态。

如果后端因为微信配置、数据库异常或 unionid/openid 异常导致未绑定，首页不进入复杂手动绑定流程，只提示：

```text
正在用你的微信身份绑定万模AI账号，请稍后下拉刷新。
```

按钮文案：

```text
正在绑定账号
```

按钮禁用。

### 7.5 活动关闭

如果后端返回 `enabled = false`：

```text
活动暂未开放
```

按钮禁用。

### 7.6 广告加载失败

提示：

```text
广告加载失败，请稍后重试
```

不发放 Token。

### 7.7 后端领取失败

提示：

```text
领取失败，请稍后重试
```

如果后端返回明确错误码，小程序转成用户能看懂的中文。

## 8. 接口清单

小程序 v1.2 只使用下面 5 个接口。

其中登录接口不仅负责创建小程序会话，也负责完成微信身份和 Chatty 后端用户的自动绑定。

### 8.1 小程序登录

```http
POST /api/wechat/miniapp/auth/login
```

请求：

```json
{
  "code": "wx.login 返回的 code"
}
```

响应：

```json
{
  "miniappSessionToken": "后端小程序会话 token",
  "user": {
    "id": "user_id",
    "displayName": "微信用户",
    "bound": true
  },
  "expiresAt": "2026-05-05T00:00:00.000Z"
}
```

正常情况下，后端应该自动绑定或自动创建用户，并返回 `bound: true`。

只有在微信配置异常、数据库异常或安全风控阻断时，才可能返回未绑定：

```json
{
  "miniappSessionToken": "后端小程序会话 token",
  "user": {
    "bound": false
  },
  "expiresAt": "2026-05-05T00:00:00.000Z"
}
```

### 8.2 当前用户信息

```http
GET /api/wechat/miniapp/me
Authorization: Bearer <miniappSessionToken>
```

响应：

```json
{
  "bound": true,
  "userId": "user_id",
  "tokenBalance": "123456"
}
```

`bound = true` 表示当前小程序 session 已经归属到一个 Chatty 用户。广告奖励和 Token 余额都必须使用这个 `userId`。

### 8.2.1 绑定相关后端逻辑

小程序不额外调用“绑定接口”。绑定发生在登录接口内部。

伪流程：

```text
POST /api/wechat/miniapp/auth/login
  -> code2Session
  -> 得到 openid / unionid
  -> 查 oauth_accounts(provider=wechat_miniapp, appid, openid)
  -> 找到：使用已有 user_id
  -> 未找到但有 unionid：查 oauth_accounts(unionid)
  -> 找到：把当前小程序 openid 绑定到这个 user_id
  -> 仍未找到：创建 User，再绑定当前小程序 openid
  -> 创建 miniapp session，并写入 user_id
```

绑定数据必须写到后端数据库，不能只写在小程序本地缓存。

### 8.3 广告奖励配置

```http
GET /api/wechat/miniapp/rewards/config
Authorization: Bearer <miniappSessionToken>
```

响应：

```json
{
  "enabled": true,
  "adUnitId": "adunit-xxx",
  "rewardTokens": "1000",
  "dailyLimitPerUser": 5,
  "remainingToday": 3,
  "rewardTokenValidDays": 7
}
```

### 8.4 创建广告奖励 Session

```http
POST /api/wechat/miniapp/rewards/sessions
Authorization: Bearer <miniappSessionToken>
```

响应：

```json
{
  "rewardSessionId": "reward_session_id",
  "adUnitId": "adunit-xxx",
  "expiresAt": "2026-05-04T12:00:00.000Z"
}
```

### 8.5 领取广告奖励

```http
POST /api/wechat/miniapp/rewards/claim
Authorization: Bearer <miniappSessionToken>
```

请求：

```json
{
  "rewardSessionId": "reward_session_id"
}
```

响应：

```json
{
  "ok": true,
  "rewardTokens": "1000",
  "tokenBalance": "124456"
}
```

## 9. 后端校验规则

后端不能相信小程序前端直接说“我看完广告了”。

后端至少需要做到：

- 创建 reward session 时校验用户是否存在。
- 创建 reward session 时校验活动是否开启。
- 创建 reward session 时校验今日剩余次数。
- 创建 reward session 时校验最短领取间隔。
- claim 时校验 reward session 是否属于当前用户。
- claim 时校验 reward session 是否过期。
- claim 时校验 reward session 是否已经领取过。
- claim 时再次校验今日次数和频率。
- claim 成功后必须写入 Token 发放记录。
- claim 成功后必须写入广告领取记录。
- 同一个 `rewardSessionId` 只能成功发放一次。

## 10. 管理后台配置项

虽然小程序本身很简单，但后端管理后台需要能配置：

- 活动是否开启。
- 微信激励视频广告位 ID。
- 每次广告奖励 Token 数量。
- 每个用户每天最多领取次数。
- 奖励 Token 有效期。
- 两次领取之间的最短间隔。
- reward session 有效时间。

推荐初始配置：

```text
enabled: false
rewardTokens: 1000
dailyLimitPerUser: 5
rewardTokenValidDays: 7
minIntervalSeconds: 30
sessionTtlSeconds: 600
```

上线前先保持 `enabled = false`，等微信广告位、合法域名和后端接口都验证通过后再开启。

## 11. 微信侧准备事项

需要准备：

- 小程序 AppID。
- 小程序 AppSecret。
- 微信激励视频广告位 ID。
- 小程序 request 合法域名：`https://aihelp.shuai.help`。
- 小程序隐私保护指引。
- 小程序类目和基础信息。
- 流量主广告位状态正常。

如果使用新的 Chatty / 万模AI 小程序，不能直接依赖旧小程序代码。旧项目里的 AppID 和广告位只能作为参考，正式上线应使用新小程序自己的配置。

## 12. 风控要求

v1.2 至少需要：

- 小程序 session 有效期。
- 单用户每日领取次数限制。
- 单用户领取间隔限制。
- reward session 过期时间。
- reward session 一次性使用。
- 后端接口频控。
- claim 接口幂等处理。
- 服务端 Token 余额为唯一可信来源。

后续可以增加：

- IP 频控。
- 设备指纹。
- 异常用户黑名单。
- 广告领取行为审计。
- 高风险账号人工审核。

## 13. 数据记录

后端至少记录：

- 用户 ID。
- 微信 openid / unionid。
- reward session ID。
- 广告位 ID。
- 奖励 Token 数量。
- reward session 创建时间。
- reward session 过期时间。
- 是否已发放。
- 发放时间。
- 领取结果。

Token 发放必须进入统一 Token 台账，不能只存在广告表里。

## 14. 验收标准

### 14.1 功能验收

- 小程序只注册首页和错误页。
- 首页没有兑换码入口。
- 首页没有流水入口。
- 首页没有个人中心入口。
- 首页没有客服入口。
- 首页没有帮助长页入口。
- 首页没有 Web 登录确认页入口。
- 首页能展示 Token 余额。
- 首页能展示今日剩余领取次数。
- 首页能展示每次奖励 Token 数。
- 点击按钮能拉起激励视频广告。
- 完整观看广告后 Token 增加。
- 中途关闭广告后 Token 不增加。
- 今日次数用完后按钮禁用。
- 活动关闭后按钮禁用。

### 14.2 安全验收

- 小程序代码里不能出现微信 AppSecret。
- 小程序代码里不能出现上游模型 API Key。
- 小程序不能自己决定发多少 Token。
- 小程序不能绕过 reward session 直接 claim。
- 重复 claim 同一个 reward session 不能重复发放。
- 清除本地缓存不会影响服务端 Token 余额。

### 14.3 体验验收

- 用户打开首页后 3 秒内能看到余额或明确错误提示。
- 主按钮在任何状态下都不会重复触发多次领取。
- 错误提示都是中文。
- 页面没有多余入口。
- 页面视觉上像一个商业化工具页，而不是测试 demo。

## 15. 当前代码目标

当前小程序代码应保持这个结构：

```text
miniprogram/
  app.js
  app.json
  app.wxss
  pages/
    index/
      index.js
      index.json
      index.wxml
      index.wxss
    error/
      error.js
      error.json
      error.wxml
      error.wxss
  utils/
    auth.js
    config.js
    request.js
```

不应该再保留这些页面：

```text
pages/my
pages/reward
pages/redeem
pages/ledger
pages/help
pages/support
pages/agreement
pages/login-confirm
```

## 16. 后续版本可选方向

只有当广告领 Token 跑通，并且真实用户使用稳定后，才考虑后续版本。

可选方向：

- 领取记录。
- 简短活动规则弹窗。
- 风控提示。
- 新手任务。
- 微信支付购买 Token。

这些都不是 v1.2 范围。
