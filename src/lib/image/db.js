// IndexedDB storage layer.
// Two object stores:
//   - tasks: { id, status, prompt, params, refs[hash], outputs[hash], createdAt, finishedAt, durationMs, error, modelId }
//   - images: { hash, blob, type, width, height, bytes, createdAt }
//
// Images are reference-counted via task refs/outputs. On startup, an orphan
// cleanup pass removes images not referenced by any task.

const DB_NAME = 'chatty-image-playground'
const DB_VERSION = 1
const STORE_TASKS = 'tasks'
const STORE_IMAGES = 'images'

let dbPromise = null

function openDb() {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('IndexedDB not available in this environment'))
  }
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE_TASKS)) {
        const store = db.createObjectStore(STORE_TASKS, { keyPath: 'id' })
        store.createIndex('createdAt', 'createdAt', { unique: false })
        store.createIndex('status', 'status', { unique: false })
      }
      if (!db.objectStoreNames.contains(STORE_IMAGES)) {
        db.createObjectStore(STORE_IMAGES, { keyPath: 'hash' })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  return dbPromise
}

function tx(storeName, mode = 'readonly') {
  return openDb().then((db) => {
    const transaction = db.transaction(storeName, mode)
    return transaction.objectStore(storeName)
  })
}

function reqToPromise(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

// ---------- tasks ----------

export async function listTasks() {
  const store = await tx(STORE_TASKS)
  const all = await reqToPromise(store.getAll())
  return all.sort((a, b) => b.createdAt - a.createdAt)
}

export async function getTask(id) {
  const store = await tx(STORE_TASKS)
  return reqToPromise(store.get(id))
}

export async function upsertTask(task) {
  const store = await tx(STORE_TASKS, 'readwrite')
  await reqToPromise(store.put(task))
  return task
}

export async function deleteTask(id) {
  const store = await tx(STORE_TASKS, 'readwrite')
  await reqToPromise(store.delete(id))
}

export async function clearAllTasks() {
  const store = await tx(STORE_TASKS, 'readwrite')
  await reqToPromise(store.clear())
}

// ---------- images ----------

export async function getImage(hash) {
  if (!hash) return null
  const store = await tx(STORE_IMAGES)
  return reqToPromise(store.get(hash))
}

export async function getImageBlob(hash) {
  const item = await getImage(hash)
  return item?.blob || null
}

export async function getImageObjectUrl(hash) {
  const blob = await getImageBlob(hash)
  if (!blob) return null
  return URL.createObjectURL(blob)
}

export async function putImage({ hash, blob, type, width, height }) {
  if (!hash || !blob) return false
  const store = await tx(STORE_IMAGES, 'readwrite')
  const exists = await reqToPromise(store.get(hash))
  if (exists) return false
  await reqToPromise(
    store.put({
      hash,
      blob,
      type: type || blob.type || 'image/png',
      width: width || null,
      height: height || null,
      bytes: blob.size,
      createdAt: Date.now()
    })
  )
  return true
}

export async function deleteImage(hash) {
  const store = await tx(STORE_IMAGES, 'readwrite')
  await reqToPromise(store.delete(hash))
}

export async function listAllImageHashes() {
  const store = await tx(STORE_IMAGES)
  return reqToPromise(store.getAllKeys())
}

// ---------- orphan cleanup ----------

export async function cleanOrphanImages() {
  const [tasks, hashes] = await Promise.all([listTasks(), listAllImageHashes()])
  const referenced = new Set()
  for (const t of tasks) {
    ;(t.refs || []).forEach((h) => referenced.add(h))
    ;(t.outputs || []).forEach((h) => referenced.add(h))
  }
  const orphans = hashes.filter((h) => !referenced.has(h))
  if (orphans.length === 0) return 0
  const store = await tx(STORE_IMAGES, 'readwrite')
  await Promise.all(orphans.map((h) => reqToPromise(store.delete(h))))
  return orphans.length
}

// ---------- helpers ----------

export async function dbStats() {
  const [tasks, hashes] = await Promise.all([listTasks(), listAllImageHashes()])
  return {
    taskCount: tasks.length,
    imageCount: hashes.length
  }
}
