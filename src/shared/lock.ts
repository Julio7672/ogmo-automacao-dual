import { open, readFile, unlink, type FileHandle } from 'node:fs/promises'
import path from 'node:path'
const lockPath = path.resolve('ogmo.lock')

function running(pid: number): boolean {
  if (!Number.isInteger(pid) || pid <= 0) return false
  try { process.kill(pid, 0); return true }
  catch (e) { return (e as NodeJS.ErrnoException).code === 'EPERM' }
}

export async function acquireLock(runId: string): Promise<FileHandle | null> {
  for (let i = 0; i < 3; i++) {
    try {
      const handle = await open(lockPath, 'wx', 0o600)
      await handle.writeFile(JSON.stringify({ pid: process.pid, runId, startedAt: new Date().toISOString() }))
      return handle
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error
      try {
        const lock = JSON.parse(await readFile(lockPath, 'utf8')) as { pid: number }
        if (running(lock.pid)) return null
        await unlink(lockPath)
      } catch (readError) {
        if ((readError as NodeJS.ErrnoException).code === 'ENOENT') continue
        await new Promise(resolve => setTimeout(resolve, 500))
      }
    }
  }
  return null
}

export async function releaseLock(handle: FileHandle) {
  await handle.close().catch(() => {})
  await unlink(lockPath).catch(() => {})
}
