# 图片对接 MinIO 后端说明

> 最后更新：2026-06-07。MinIO/S3 图片存储已在当前后端落地，本文前半部分是当前实现说明，后半部分保留原改造计划作为设计背景。
>
> 当前目标：生成图片、用户上传参考图和任务历史以服务端 PostgreSQL + MinIO/S3 为权威存储，浏览器 IndexedDB 只作为本地缓存。

## 当前实现概览

已落地内容：

- Prisma 迁移：`20260513143000_add_image_storage`
- Nest 模块：`backend/src/modules/storage/`、`backend/src/modules/images/`
- 聊天图片服务：`backend/src/modules/chat/chat-image.service.ts`
- 数据表/模型：`Image`、`ImageTask`、`ImageTaskInput`、`ImageTaskOutput`、`StorageUsage`、`UserImageRef`
- 上传接口：`POST /api/images/uploads`
- 任务历史：`GET /api/images/tasks`
- 使用统计：`GET /api/images/usage`
- 私有图片读取：`GET /api/images/:id`、`GET /api/images/:id/raw`
- 生图与编辑：`POST /api/images/generations`、`POST /api/images/edits`

## 当前环境变量

```text
IMAGE_BACKEND=minio
IMAGE_PRESIGN_TTL_SECONDS=21600
IMAGE_UPLOAD_MAX_BYTES=26214400
IMAGE_USER_STORAGE_DEFAULT_BYTES=0
IMAGE_GC_DRY_RUN=false
IMAGE_GC_OLDER_THAN_HOURS=24
MINIO_ENDPOINT
MINIO_PUBLIC_ENDPOINT
MINIO_REGION
MINIO_ACCESS_KEY
MINIO_SECRET_KEY
MINIO_BUCKET
MINIO_FORCE_PATH_STYLE=true
```

生产建议：

- Bucket 保持 private。
- 后端持有 `MINIO_ACCESS_KEY` / `MINIO_SECRET_KEY`，前端和小程序不得持有对象存储凭据。
- `MINIO_PUBLIC_ENDPOINT` 用于生成客户端可访问 URL；如果没有公网对象存储域名，可通过后端 `/api/images/:id/raw` 代理读取。
- `IMAGE_UPLOAD_MAX_BYTES` 当前默认 25 MB，与参考图上传限制一致。

## 锁定的关键决策

| 项目 | 决策 |
|------|------|
| MinIO 部署 | 独立 VM / 外部 S3 兼容服务，不进 docker-compose；通过 `MINIO_ENDPOINT` 走网络 |
| 参考图记账 | 同 hash 多用户上传 → 每人独立计 bytes（即使物理只存一份） |
| 入库时机 | 上游返回后**同步**下载并 putObject 到 MinIO 后才返回前端 |
| 存储额度 | 不限量；`StorageUsage` 仅用于统计/监控，预留字段以备后续接限额 |

## 当前接口

```text
POST /api/images/uploads
GET  /api/images/usage
GET  /api/images/tasks?limit=30
GET  /api/images/:id
GET  /api/images/:id/raw
POST /api/images/generations
POST /api/images/edits
```

`POST /api/images/edits` 支持三类参考图输入：

- multipart `images` 文件。
- JSON `images` data URL 数组，兼容旧前端。
- `imageIds`，引用服务端已上传图片。

---

以下为原设计背景，保留用于理解取舍与后续扩展。


---

## 一、总体架构变更

### 旧链路
```
frontend ──prompt+ref(base64)─▶ backend ──▶ sub2api/上游
                                            │
frontend ◀──images: dataURL/URL[]────────── backend
   │
   └──▶ IndexedDB (本地持久化、跨设备不同步)
```

### 新链路
```
[上传参考图]
frontend(blob) ──multipart──▶ POST /api/images/uploads
                              ├─ 校验 + sha256
                              ├─ MinIO putObject (key = sha256/<hash>.<ext>)
                              ├─ Image 表 upsert + refCount++
                              └─ 返回 { imageId, hash, url(presigned) }

[生成 / 编辑]
frontend ──prompt+refs:[imageId]──▶ POST /api/images/generations 或 /edits
                                     ├─ 校验 + 余额
                                     ├─ ImageTask(status=running) 入库
                                     ├─ 拼上游请求（edits 时把 refs 还原成 blob 上传）
                                     ├─ 上游返回 images[]
                                     ├─ 逐张：下载 → sha256 → MinIO put → Image 表 upsert
                                     ├─ ImageTaskOutput 串起 task↔image
                                     ├─ ImageTask(status=done, finishedAt)
                                     └─ 返回 { taskId, outputs:[{imageId, url}] }

[历史]
frontend ──▶ GET /api/image-tasks?cursor=...&filter=done&q=cat
            └─ 返回分页任务 + 每张图的短期 presigned URL

[取单张图]
frontend img.src = presignedUrl  (直接到 MinIO；过期前自动通过 backend 续签)
```

### 关键设计取舍
- **图片以 sha256 全局去重**：同样的输出 / 参考图只占一份 MinIO 空间，DB 用 `refCount` 管引用计数。
- **MinIO 不公开**：bucket policy 设为 private，所有访问走后端 presigned GET URL（默认 6 小时），避免重新部署 CDN/反代。
- **前端不再发 base64**：参考图改为先 multipart 上传拿到 `imageId`，再用 `imageId[]` 调生成接口；这样请求体能从几十 MB 缩到几百字节，也消除 200 MB 的 body limit 黑科技。
- **IndexedDB 不删，降级为缓存层**：仍能离线浏览 + 加快滚动；权威数据在服务器。

---

## 二、数据模型（Prisma schema 新增）

放在 `backend/prisma/schema.prisma`。

```prisma
// 物理图片对象（MinIO 实体的元数据）
model Image {
  id           String         @id @default(uuid())
  hash         String         @unique  // SHA-256 hex，去重键
  bucket       String
  objectKey    String         // sha256/<aa>/<hash>.<ext>，加 2 字符前缀分桶
  contentType  String
  bytes        Int
  width        Int?
  height       Int?
  source       ImageSource    @default(generated)  // upload | generated
  ownerUserId  String?        // 第一个上传/生成的用户，用于配额；null=匿名/系统
  refCount     Int            @default(0)
  createdAt    DateTime       @default(now())
  updatedAt    DateTime       @updatedAt
  owner        User?          @relation(fields: [ownerUserId], references: [id], onDelete: SetNull)
  taskInputs   ImageTaskInput[]
  taskOutputs  ImageTaskOutput[]
  @@index([ownerUserId, createdAt])
}

enum ImageSource {
  upload     // 用户上传的参考图
  generated  // 模型生成的输出
  system     // 内置/示例
}

// 图片生成 / 编辑任务
model ImageTask {
  id              String          @id @default(uuid())
  userId          String
  conversationId  String?         // 可选：归到某个聊天会话
  mode            ImageTaskMode   // generate | edit
  modelId         String
  prompt          String
  paramsJson      Json            // { size, quality, output_format, output_compression, moderation, n, sizePreset:{target,aspect} }
  status          ImageTaskStatus @default(pending)
  error           String?
  requestId       String          @unique   // 内部 requestId，沿用 randomToken(18)
  sub2apiRequestId String?
  startedAt       DateTime?
  finishedAt      DateTime?
  durationMs      Int?
  createdAt       DateTime        @default(now())
  updatedAt       DateTime        @updatedAt
  user            User            @relation(fields: [userId], references: [id], onDelete: Cascade)
  conversation    Conversation?   @relation(fields: [conversationId], references: [id], onDelete: SetNull)
  inputs          ImageTaskInput[]
  outputs         ImageTaskOutput[]
  llmRequest      LlmRequest?     @relation(fields: [requestId], references: [requestId], onDelete: SetNull, name: "ImageTaskLlmRequest")
  @@index([userId, createdAt])
  @@index([userId, status])
}

enum ImageTaskMode { generate edit }
enum ImageTaskStatus { pending running done failed canceled }

model ImageTaskInput {
  id        String    @id @default(uuid())
  taskId    String
  imageId   String
  ordinal   Int
  task      ImageTask @relation(fields: [taskId], references: [id], onDelete: Cascade)
  image     Image     @relation(fields: [imageId], references: [id], onDelete: Restrict)
  @@unique([taskId, ordinal])
  @@index([imageId])
}

model ImageTaskOutput {
  id             String    @id @default(uuid())
  taskId         String
  imageId        String
  ordinal        Int
  revisedPrompt  String?
  task           ImageTask @relation(fields: [taskId], references: [id], onDelete: Cascade)
  image          Image     @relation(fields: [imageId], references: [id], onDelete: Restrict)
  @@unique([taskId, ordinal])
  @@index([imageId])
}

// 用户存储统计（不限量；仅作统计/可视化用，方便后期接配额）
model StorageUsage {
  userId       String   @id
  bytesTotal   BigInt   @default(0)   // 累计字节数（即使物理去重，仍逐用户记账）
  imagesCount  Int      @default(0)   // 关联的图片数量（含去重）
  updatedAt    DateTime @updatedAt
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

需要在 `User` 上加反向关系：
```prisma
model User {
  // ...existing fields
  imageTasks      ImageTask[]
  ownedImages     Image[]
  storageUsage    StorageUsage?
}
```

迁移命名建议：`20260513_add_image_storage`。

---

## 三、MinIO 设计

### 部署形态
**确定方案：MinIO 装在独立 VM / 现成 S3 兼容服务上，不放进 backend 的 docker-compose**。后端通过 `MINIO_ENDPOINT` 走网络访问。这意味着：

- backend 没有 minio 这个 service 依赖，部署互不耦合
- backend 需要做好"endpoint 不可达"的降级（health check、重试、熔断）
- 网络要打通：backend 所在节点到 MinIO 的 9000 端口（生产建议走内网或 VPN）

如果后期切到 AWS S3 / 阿里 OSS / Cloudflare R2，只需要改 endpoint 和 access key，代码无须改动（用 AWS SDK v3 是为此设计）。

### 运维 / 初始化（在 MinIO VM 上手动执行一次）
```bash
# 安装 mc（MinIO Client）
wget https://dl.min.io/client/mc/release/linux-amd64/mc
chmod +x mc

# 配置 alias
./mc alias set local http://127.0.0.1:9000 <ROOT_USER> <ROOT_PASSWORD>

# 创建 bucket、关闭公开访问
./mc mb local/chatty-images
./mc anonymous set none local/chatty-images

# 创建专用 access key（不要直接给 backend 用 root key）
./mc admin user svcacct add local <ROOT_USER> \
  --access-key "chatty-backend-prod" \
  --secret-key "<32+ char random>"

# 给该 user 限定到 bucket 的 RW 权限
./mc admin policy create local chatty-rw - <<'EOF'
{
  "Version": "2012-10-17",
  "Statement": [
    { "Effect": "Allow", "Action": ["s3:ListBucket"], "Resource": ["arn:aws:s3:::chatty-images"] },
    { "Effect": "Allow", "Action": ["s3:GetObject","s3:PutObject","s3:DeleteObject","s3:GetObjectTagging","s3:PutObjectTagging"], "Resource": ["arn:aws:s3:::chatty-images/*"] }
  ]
}
EOF
./mc admin policy attach local chatty-rw --user chatty-backend-prod
```

把 `chatty-backend-prod` 的 access key / secret 灌到 backend 的 env 里。Root key 留给运维。

### Bucket 与对象命名
- Bucket: `chatty-images`
- Key 结构：`sha256/<前2位 hash>/<完整 hash>.<ext>`
  - 例：`sha256/3f/3fbc1...d8.png`
  - 前 2 位分桶能让 MinIO 内部目录更均匀，避免单目录百万对象。
- 不带用户隔离前缀（去重要求所有用户共享对象池），用户级隔离靠 DB 控制 + presigned URL 鉴权。

### 元数据
putObject 时设置：
- `Content-Type`: 真实 MIME（来自 sniff）
- `x-amz-meta-source`: `upload` / `generated`
- `x-amz-meta-task-id`: 第一次创建该 hash 的任务 ID（仅信息用途）
- `x-amz-meta-user-id`: 首次提交用户 ID

### 生命周期规则
通过 `mc ilm` 或 console 配置：
- 失败任务的图：靠应用层立即删除（不依赖生命周期）
- 7 天未被任何 task 引用且无 owner 的孤儿：保险扫描（应用层 cron）
- 不开放公开访问

---

## 四、新增 Nest 模块

### 4.1 `backend/src/modules/storage/`

```
storage/
├── storage.module.ts
├── minio.service.ts          // 封装 AWS SDK / minio-js
├── storage.health.ts         // 启动时检测 bucket 存在
└── types.ts
```

**MinioService 接口**（建议用 `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner`，纯 S3 兼容）：

```ts
class MinioService {
  putObject(params: { key: string; body: Buffer; contentType: string; metadata?: Record<string,string>; ifNotExists?: boolean }): Promise<{ etag: string; bytes: number }>
  getObject(key: string): Promise<{ body: Readable; contentType: string; bytes: number }>
  headObject(key: string): Promise<{ contentType: string; bytes: number; metadata: Record<string,string> } | null>
  deleteObject(key: string): Promise<void>
  presignGet(key: string, opts: { ttl: number; responseContentType?: string; responseDisposition?: string }): Promise<string>
  listByPrefix(prefix: string, limit?: number): AsyncIterable<{ key: string; size: number; lastModified: Date }>
}
```

要点：
- `forcePathStyle: true`（MinIO 必须）
- 客户端用 `region: 'us-east-1'`（占位，MinIO 不校验）
- `ifNotExists`：先 `headObject`，404 才 put，去重场景下避免重复传字节
- presign 域名：如果 MinIO 在内网（`http://minio:9000`），生成的 URL 客户端访问不了；需要 `MINIO_PUBLIC_ENDPOINT` 重写 host

### 4.2 `backend/src/modules/images/`

```
images/
├── images.module.ts
├── images.service.ts         // 业务：上传、查询、删除、垃圾回收、存储用量
├── images.controller.ts      // /images 子路由
├── image-usage.service.ts    // StorageUsage 增减
├── image-hasher.ts           // sha256 + 图片尺寸 sniff
└── dto/                      // class-validator
```

**ImagesService 关键方法**：

```ts
class ImagesService {
  // 用户上传参考图：multipart 单文件
  uploadReference(userId: string, file: { buffer: Buffer; mimetype: string; size: number }): Promise<ImageDto>

  // 系统/上游下载并落地：复用同一个 hash 路径
  ingestFromUrl(args: { userId: string; url: string; expectedType?: string; source: ImageSource; taskHint?: string }): Promise<Image>
  ingestFromBuffer(args: { userId: string; buffer: Buffer; contentType: string; source: ImageSource; taskHint?: string }): Promise<Image>

  // 业主权限校验 + 颁发 presigned URL
  presignForUser(userId: string, imageId: string, opts?: { ttl?: number; download?: boolean }): Promise<{ url: string; expiresAt: Date }>

  // 引用计数变更
  retain(imageId: string): Promise<void>   // refCount++
  release(imageId: string): Promise<void>  // refCount-- ; 归零异步删

  // 批量解析：参考图列表 imageIds → 校验属于 user + 还活着
  resolveBatch(userId: string, imageIds: string[]): Promise<Image[]>

  // 垃圾回收（cron 调用）
  sweepOrphans(opts: { olderThan: Date; dryRun?: boolean }): Promise<{ scanned: number; deleted: number }>
}
```

**实现细节**：
- `uploadReference` 流程：
  1. 校验 MIME 白名单（png/jpeg/webp/gif）
  2. 校验 size ≤ 25 MB
  3. 校验用户存储未超限（`bytesTotal + size <= bytesLimit`）
  4. sha256 计算
  5. `headObject` 判断对象是否存在
  6. 不存在 → putObject + 计入 `StorageUsage.bytesTotal`
  7. upsert Image (hash 唯一)，refCount++（同一用户多次上传同图也只算一份）
  8. 返回 { imageId, hash, presignedUrl }
- `ingestFromUrl`：
  1. fetch（限 30s 超时、最大 25 MB 流式）
  2. 检测 Content-Type；如果上游是 base64 data URL，剥离后转 buffer
  3. sha256 → 同 upload 路径
  4. `source: 'generated'`
- `presignForUser`：
  - 鉴权：Image 的 owner = userId，或者被 user 的 ImageTask 引用过；管理员豁免
  - 调 `MinioService.presignGet(key, { ttl })`
  - 如果配 `MINIO_PUBLIC_ENDPOINT`，替换 host
- `release` → `refCount` 减到 0 + 没有 task input/output 引用 → 进入"待删"状态，可立即 deleteObject 也可走批量

**ImagesController 路由**：

```
POST   /api/images/uploads           multipart, field=file
GET    /api/images/:id               JSON: { id, hash, contentType, bytes, width, height, url }
GET    /api/images/:id/raw           302 → presigned (短链分享)
DELETE /api/images/:id                只允许 owner，并且没被任务引用
GET    /api/images/usage             { bytesTotal, bytesLimit, imagesCount }
```

multipart 用 `@nestjs/platform-express` + `FilesInterceptor` / `FileInterceptor`，配合 `multer` `memoryStorage`（已经在依赖里）。

### 4.3 `backend/src/modules/image-tasks/`

```
image-tasks/
├── image-tasks.module.ts
├── image-tasks.service.ts
├── image-tasks.controller.ts
├── upstream-image.client.ts        // 拼接上游请求，替代现在 chat.service 里的逻辑
└── dto/
```

**ImageTasksService 关键方法**：

```ts
class ImageTasksService {
  generate(userId: string, input: GenerateInput): Promise<ImageTaskDto>
  edit(userId: string, input: EditInput): Promise<ImageTaskDto>
  list(userId: string, query: { cursor?: string; limit?: number; status?: string; q?: string }): Promise<{ items: ImageTaskDto[]; nextCursor?: string }>
  get(userId: string, taskId: string): Promise<ImageTaskDto>
  delete(userId: string, taskId: string): Promise<void>
}
```

**generate 内部流程**：
```ts
async generate(userId, input) {
  // 1. 校验参数（沿用 chat.service.validateImageParams）
  await this.validate(input)
  // 2. 积分余额
  await this.points.assertEnough(userId)
  // 3. 模型可用
  const model = await this.models.assertEnabled(input.model)
  // 4. 引用计数 refs（仅 edit 用）
  const refImages = await this.images.resolveBatch(userId, input.refImageIds || [])
  // 5. 入库 task = running
  const task = await this.prisma.imageTask.create({ data: { ..., status: 'running' }})
  await this.prisma.imageTaskInput.createMany({ data: refImages.map((img, i) => ({ taskId: task.id, imageId: img.id, ordinal: i })) })
  await Promise.all(refImages.map((img) => this.images.retain(img.id)))
  // 6. 调上游
  try {
    const upstream = await this.upstream.callGenerations({ model, prompt, params, refImages? })
    // 7. 逐图入库
    const outputs = []
    for (const [i, raw] of upstream.images.entries()) {
      const img = await this.images.ingestFromUrlOrBuffer({ userId, ...raw, source: 'generated', taskHint: task.id })
      await this.images.retain(img.id)
      const output = await this.prisma.imageTaskOutput.create({ data: { taskId: task.id, imageId: img.id, ordinal: i, revisedPrompt: raw.revisedPrompt } })
      outputs.push(output)
    }
    await this.prisma.imageTask.update({ where: { id: task.id }, data: { status: 'done', finishedAt: new Date(), durationMs } })
    await this.sub2api.ingestCompletionUsage({ ..., raw: { source: 'image_generation' } })
    return this.toDto(task, outputs)
  } catch (err) {
    // 8. 失败：释放参考图 refCount + 标记 task failed
    await Promise.all(refImages.map((img) => this.images.release(img.id)))
    await this.prisma.imageTask.update({ where: { id: task.id }, data: { status: 'failed', error: err.message, finishedAt: new Date() } })
    throw err
  }
}
```

**delete 内部流程**：
1. 取 task + inputs + outputs
2. `images.release()` 每张图（refCount--）
3. 删除 ImageTaskInput / Output / Task

**API 路由**（替换 `chat/images/*`，挂在新 controller）：

```
POST   /api/image-tasks            generate
POST   /api/image-tasks/edit       edit
GET    /api/image-tasks            list（带 cursor 分页）
GET    /api/image-tasks/:id        详情，附 outputs[].url
DELETE /api/image-tasks/:id        删除
```

为了兼容前端现在调用的 `/api/images/generations` 和 `/api/images/edits`，在新 controller 上加 `@Post('images/generations')` 和 `@Post('images/edits')` 别名，老路径继续可用。

### 4.4 模块装配

`app.module.ts` 增加：
```ts
@Module({
  imports: [
    // ...existing
    StorageModule,
    ImagesModule,
    ImageTasksModule,
  ],
})
```

`ChatModule` 删掉 `generateImage` / `editImage`（或保留壳函数转发到 `ImageTasksService`，便于灰度），把 chat 的 controller 上的 `@Post('images/...')` 移除。

---

## 五、配置（新增 env）

`.env.example` 追加：
```
# MinIO / S3-compatible object storage
MINIO_ENDPOINT=http://minio:9000
MINIO_PUBLIC_ENDPOINT=https://files.aihelp.shuai.help   # presigned URL 对外用的 host
MINIO_REGION=us-east-1
MINIO_ACCESS_KEY=
MINIO_SECRET_KEY=
MINIO_BUCKET=chatty-images
MINIO_FORCE_PATH_STYLE=true
MINIO_USE_SSL=false

# 图片相关
IMAGE_PRESIGN_TTL_SECONDS=21600          # 6 h
IMAGE_UPLOAD_MAX_BYTES=26214400          # 25 MB
IMAGE_USER_STORAGE_DEFAULT_BYTES=0            # 0 = 不限；保留字段以备将来开启限额
IMAGE_GC_DRY_RUN=false
IMAGE_GC_OLDER_THAN_HOURS=24
```

`config.module.ts`（NestJS ConfigModule）已经在用，按这套读。

---

## 六、依赖新增

```bash
cd backend
npm i @aws-sdk/client-s3 @aws-sdk/s3-request-presigner multer
npm i -D @types/multer
```

不引入 minio-js，直接用 AWS SDK 是因为：
- 体积差不多但兼容性更好
- presign 实现更标准，未来切真 S3 / OSS 不用改

---

## 七、前端改造点

为了配合后端，前端这些文件要改：

| 文件 | 变更 |
|------|------|
| `src/lib/image/api.js` | 加 `uploadReferenceImage(file)` 调 `/api/images/uploads`；`generateImageRequest` 改成传 `refImageIds`；新增 `listImageTasks`, `getImageTask`, `deleteImageTask` |
| `src/lib/image/db.js` | 改名为"本地缓存层"。增加 `cacheImage(imageId, blob)`、`getCachedImage(imageId)`；不再是权威 |
| `src/components/image/ReferenceUploader.jsx` | `ingestFiles` 改成调 `uploadReferenceImage` 拿 `imageId`；显示阶段用后端返回的 presigned url |
| `src/store/useImageStore.js` | `refs` 字段改为 `[{ imageId, url, hash, ... }]`；`taskIndex` 由 `listImageTasks` 填充，加入分页 cursor |
| `src/app/image/page.jsx` | 启动时从后端 `list` 拉取任务；`handleGenerate` 用 `refImageIds` |
| `src/components/image/TaskDetailDialog.jsx` | `getTask` 改成后端拉取；`addAsRef` 改成把 outputImage 的 `imageId` 加进 store |
| `src/components/image/ImportExportBar.jsx` | 改成调 `POST /api/image-tasks/export` 拿 ZIP（后端打包），或者去掉前端导入功能 |

老的 IndexedDB 代码可以暂时保留作为离线缓存（presigned URL 过期前缓存 blob），但所有"数据源"路径要替换。

---

## 八、鉴权 / 安全

1. **所有图片端点强制登录**，沿用现有 `UserSessionGuard`。
2. **presign 颁发前必查 ownership**：`image.ownerUserId === userId` 或 `Image` 被该 user 的 ImageTask 引用。管理员有跨用户读取权（admin guard）。
3. **MIME 白名单**：`image/png`, `image/jpeg`, `image/webp`, `image/gif`。在 upload 和 ingestFromUrl 都校验。
4. **图片头校验**：用 `file-type` 或自己嗅探前 12 字节 magic number，防止 MIME 假冒（用户上传 .png 实际是 .zip）。
5. **请求体限制**：upload 端点单独配 multer limits `{ fileSize: 25MB, files: 16 }`。其它 JSON 路由把 body limit 从 200MB 收回到 1MB（参考图改成 imageId 后不需要大 body 了）。
6. **速率限制**：upload 端点用 `@nestjs/throttler` 配 `{ ttl: 60, limit: 30 }`（每分钟 30 张）。
7. **Presigned URL 不可枚举**：URL 内嵌 sig，TTL 6h；额外加 `response-content-disposition` 强制 inline，避免 XSS（如果 MIME 是 image/* 不太可能，但保险）。
8. **删除时不真删 MinIO**：进入 grace period（24 h），跑 GC 时再真删；防止误删。

---

## 九、配额 / 计费（不限量策略）

**决策：暂不限制用户存储量，只用 Token 余额控制图片生成成本**。但 `StorageUsage` 仍保留并实时更新，原因：

1. 给前端 `GET /api/images/usage` 用，便于用户看到"我用了多少 MB / 共 N 张图"
2. 给后台管理（admin）做用户排行 / 异常检测（24 h 内突增 5 GB → 标记可疑）
3. 留给未来按 plan 限额的可能性

**记账规则**（按用户选项：同 hash 多用户上传 → 每人都计）：
```
on upload(userId, imageId, bytes):
  if (DB 中不存在 user×imageId 的引用关系) {
     UPDATE StorageUsage SET bytesTotal += bytes, imagesCount += 1 WHERE userId = ?
  }
on release(userId, imageId, bytes):
  if (用户对这张图的最后一份引用消失) {
     UPDATE StorageUsage SET bytesTotal -= bytes, imagesCount -= 1
  }
```
为了准确实现"每个用户独立记账"，引入辅助表：

```prisma
// 用户对图片的引用（轻量索引；用于配额记账）
model UserImageRef {
  userId  String
  imageId String
  count   Int    @default(0)   // 该用户引用此图的总次数（上传 + 各 task input/output）
  bytes   Int                  // 冗余存 bytes，删时不用 join
  @@id([userId, imageId])
  @@index([userId])
}
```

- upload / ingest：`UserImageRef.count++`；count 从 0 变 1 时记 `StorageUsage.bytesTotal += bytes`
- release (删除 task / GC 释放)：`UserImageRef.count--`；count 归 0 时 `StorageUsage.bytesTotal -= bytes`
- 物理对象由全局 `Image.refCount` 决定何时真删（与 user 维度的 ref 独立）

**Token 计费**：图片生成沿用 `sub2api.ingestCompletionUsage`，根据 `raw.source === 'image_generation' | 'image_edit'` 走单独定价（参考 OpenAI gpt-image-2 三档：low / medium / high），在 `Sub2apiService` 里加图片定价表。

---

## 十、迁移 / 上线步骤

由于线上还没有图片任务（前端历史在用户浏览器 IndexedDB），不需要数据迁移。流程：

1. **部署 MinIO**：先单独部一台或一个 docker-compose service，建好 bucket。
2. **配 env**：把 ENDPOINT / KEY / BUCKET 灌进 `.env`，重启后端。
3. **Prisma migrate**：
   ```bash
   cd backend
   npm run prisma:migrate -- --name add_image_storage
   ```
4. **加 feature flag**：`IMAGE_BACKEND=minio | legacy`，灰度时可回退。
5. **前端发版**：先发布带 fallback 的版本（检测 backend 能力），再切换。
6. **保留 chat.service.generateImage 旧实现一周**，给灰度对照。
7. **完全切换后**移除旧代码、删除 200 MB body limit。

---

## 十一、错误处理与重试

| 失败位置 | 处理 |
|---------|------|
| 上游 5xx / 超时 | task=failed，error 写明，参考图 ref 释放 |
| MinIO 不可达（put 时） | 重试 3 次指数退避（500ms / 2s / 8s）；最终失败 → task=failed，错误码 `storage_unavailable` |
| 上游成功但部分图 put 失败 | 已成功的算 done，失败的标 ordinal，error 字段记 partial |
| presign 失败 | API 返回 503；客户端可重试 |
| GC 删除失败 | 留待下次 cron，最多重试 5 次 |

要点：**事务保护**——put 到 MinIO 是不可回滚的，要"先 put 再写 DB"；如果 put 成功但 DB 写失败，则下次 GC 会扫到孤儿对象清理。

---

## 十二、定时任务

新增 `images/images.cron.ts`，依赖 `@nestjs/schedule`（已经在 deps）：

```ts
@Cron(CronExpression.EVERY_HOUR)
async sweepOrphanImages() {
  // refCount=0 且 createdAt < now - 24h 的图，从 MinIO + DB 删除
  await this.images.sweepOrphans({ olderThan: subHours(new Date(), 24) })
}

@Cron(CronExpression.EVERY_30_MINUTES)
async cancelStuckTasks() {
  // running 状态超过 10 分钟的任务标 canceled
}
```

可选：定期对账（MinIO `listByPrefix` vs DB Image 表）查双向不一致，先 dry-run 上报。

---

## 十三、监控

Prometheus 指标（用 `prom-client`，需引入）：
- `chatty_image_put_duration_seconds`（直方图，按 source/format 打 label）
- `chatty_image_put_errors_total`
- `chatty_image_task_duration_seconds`（按 mode/quality/size 打 label）
- `chatty_image_storage_bytes`（按 userId 取 top10 ? 或全局 gauge）
- `chatty_image_presign_calls_total`

告警：
- MinIO putObject 错误率 > 1% 持续 5 min
- 单用户 1 h 内 upload 失败 > 50 次
- 存储总量 > 80% 容量

---

## 十四、测试

### 单元
- `image-hasher.test.ts`：sha256 一致性、ext 判定、尺寸 sniff
- `minio.service.test.ts`：使用 `@testcontainers/minio` 拉起 MinIO 跑真 put/get/presign
- `image-usage.service.test.ts`：增减、超限拦截

### 集成（每次部署跑）
- 上传一张参考图 → 校验 MinIO 对象存在 → 校验 StorageUsage 增加
- 生成 1 张图 → 校验 Image / ImageTaskOutput / refCount
- 删除任务 → refCount-- → 若归零跑 GC → MinIO 对象消失
- 同一 hash 多个用户上传 → MinIO 只一份 → 每个用户 StorageUsage 增加（去重时是否计入用户额度 == 业务决策）
- presign URL 在 TTL 内可用、过期后 403
- 越权访问别人的 imageId → 403

### 手动 / E2E
- 前端拖拽 16 张图、删除其中几张、生成、刷新页面（应能从后端拉回历史）

---

## 十五、实施顺序（建议两周）

| 周 | 工作 |
|----|------|
| W1 D1 | 部 MinIO、写 `StorageModule` + `MinioService` + 健康检查 |
| W1 D2 | Prisma 改 schema、migrate、单测 |
| W1 D3 | `ImagesModule`：upload / get / delete / storage usage |
| W1 D4 | `ImageTasksModule`：generate（先不接 edit）+ controller 别名兼容旧前端路径 |
| W1 D5 | 加 edit / 参考图链路 |
| W2 D1 | 前端 `lib/image/api.js` 接入 uploads；ReferenceUploader 改造 |
| W2 D2 | 前端 useImageStore、TaskGallery、TaskDetailDialog 改造为后端拉取 |
| W2 D3 | 离线缓存层（IndexedDB 改用法）、加载体验 |
| W2 D4 | 监控、GC cron、告警 |
| W2 D5 | 灰度 + 回归测试，移除老代码 |

---

## 十六、风险与缓解

| 风险 | 缓解 |
|------|------|
| MinIO 单点故障 | 生产部 MinIO Distributed 模式（4 节点 + EC），或者直接换公有云 S3 兼容 |
| 上游返回签名 URL，下载到 backend 这一段失败率高 | 失败重试 + 临时回退把 URL 直接给前端（带过期警告） |
| 用户上传量爆炸 | StorageUsage 硬限制 + plan 收费 |
| 越权访问 | 颁发 presign 前必校验 ownership，DB 索引覆盖 |
| Hash 碰撞 | SHA-256 实际可忽略；若担心可二次校验 bytes 大小 |
| 大文件 OOM | upload 用 stream 不要全部读到 buffer；ingestFromUrl 用 stream + 累计 hash |

---

## 十七、后续可拓展

- 公开分享：给某张图打 `public=true`，颁发长效 token URL
- 缩略图：put 时同步生成 256px 缩略图，列表用
- CDN 接入：MinIO 前挂 Cloudflare，presign URL 走 CDN
- 多 region：bucket per region + DB 记 region
- 图片审核：上游审核 + 自家二次审核 hook
- 文件夹 / 收藏：在 ImageTask 之上加 `Collection` 表

---

## 附：参数总览

| 名称 | 默认 | 说明 |
|------|------|------|
| MINIO_BUCKET | `chatty-images` | 单 bucket |
| Presign TTL | 21600 s (6h) | 客户端缓存 + 自动续签 |
| Upload max size | 25 MB / 图 | 与上游限制对齐 |
| 用户默认配额 | 不限 | StorageUsage 仅统计 |
| GC 周期 | 60 min | EVERY_HOUR |
| GC grace | 24 h | 误删保护 |
| 重试 | 3 次指数退避 | put/upstream |
| Throttle | 30 / 60s | upload 端点 |

---

> 全部完成后，前端把"图片任务"区域改成完全服务端驱动，IndexedDB 只剩缓存职责；多设备登录看到同一历史；MinIO 是唯一权威存储。
