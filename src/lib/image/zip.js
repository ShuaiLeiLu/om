// ZIP import/export for image tasks.
// Export packages task metadata + raw image binaries; import is reverse.
// Uses fflate (small, fast, runs in browser).
//
// Layout:
//   manifest.json   – { version, exportedAt, tasks: [...] }
//   images/<hash>.<ext>

import { zipSync, unzipSync, strToU8, strFromU8 } from 'fflate'
import { getImage, putImage, listTasks, upsertTask } from './db'
import { sha256Hex } from './hash'

const EXPORT_VERSION = 1

function extFromType(type) {
  if (!type) return 'png'
  if (type.includes('jpeg') || type.includes('jpg')) return 'jpg'
  if (type.includes('webp')) return 'webp'
  if (type.includes('gif')) return 'gif'
  return 'png'
}

async function blobToUint8(blob) {
  return new Uint8Array(await blob.arrayBuffer())
}

export async function exportAllTasksToZip() {
  const tasks = await listTasks()
  const entries = {}

  const usedHashes = new Set()
  for (const t of tasks) {
    ;(t.refs || []).forEach((h) => usedHashes.add(h))
    ;(t.outputs || []).forEach((h) => usedHashes.add(h))
  }

  const manifestImages = []
  for (const hash of usedHashes) {
    const rec = await getImage(hash)
    if (!rec) continue
    const ext = extFromType(rec.type)
    const name = `images/${hash}.${ext}`
    entries[name] = await blobToUint8(rec.blob)
    manifestImages.push({
      hash,
      file: name,
      type: rec.type,
      width: rec.width,
      height: rec.height,
      bytes: rec.bytes,
      createdAt: rec.createdAt
    })
  }

  const manifest = {
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    appOrigin: 'chatty-image-playground',
    tasks,
    images: manifestImages
  }
  entries['manifest.json'] = strToU8(JSON.stringify(manifest, null, 2))

  const zipped = zipSync(entries, { level: 6 })
  return new Blob([zipped], { type: 'application/zip' })
}

export async function importTasksFromZip(file, { onProgress } = {}) {
  const buf = new Uint8Array(await file.arrayBuffer())
  const unzipped = unzipSync(buf)
  if (!unzipped['manifest.json']) {
    throw new Error('ZIP 文件缺少 manifest.json')
  }
  const manifest = JSON.parse(strFromU8(unzipped['manifest.json']))
  if (!Array.isArray(manifest.tasks)) {
    throw new Error('manifest.json 格式不正确')
  }

  const imageEntries = manifest.images || []
  let imageImported = 0
  let imageSkipped = 0

  for (const meta of imageEntries) {
    onProgress?.({ phase: 'images', current: imageImported + imageSkipped, total: imageEntries.length })
    const data = unzipped[meta.file]
    if (!data) {
      imageSkipped += 1
      continue
    }
    const blob = new Blob([data], { type: meta.type || 'image/png' })
    // verify hash; recompute to be safe in case of corrupted manifest
    let hash = meta.hash
    try {
      const recomputed = await sha256Hex(blob)
      if (recomputed) hash = recomputed
    } catch {}
    const inserted = await putImage({
      hash,
      blob,
      type: meta.type,
      width: meta.width,
      height: meta.height
    })
    if (inserted) imageImported += 1
    else imageSkipped += 1
  }

  let taskImported = 0
  for (const task of manifest.tasks) {
    onProgress?.({ phase: 'tasks', current: taskImported, total: manifest.tasks.length })
    await upsertTask(task)
    taskImported += 1
  }

  return {
    imageImported,
    imageSkipped,
    taskImported,
    totalImages: imageEntries.length,
    totalTasks: manifest.tasks.length
  }
}
