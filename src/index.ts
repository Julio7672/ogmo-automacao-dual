import 'dotenv/config'
import cron from 'node-cron'
import { randomUUID } from 'node:crypto'
import { acquireLock, releaseLock } from './shared/lock.js'
import { log, screenshot, timezone, withBrowser, type Site } from './shared/runtime.js'
import { runSuape } from './sites/suape.js'
import { runRecife } from './sites/recife.js'

const schedules: Record<Site, string[]> = {
  suape: [
    process.env.CRON_SCHEDULE_0915 || '15 9 * * *',
    process.env.CRON_SCHEDULE_MORNING || '10 10,11 * * *',
    process.env.CRON_SCHEDULE_AFTERNOON || '40 15,16 * * *',
  ],
  recife: [
    process.env.RECIFE_CRON_MORNING || '20 6,11 * * *',
    process.env.RECIFE_CRON_EVENING || '0 18 * * *',
  ],
}

async function execute(site: Site) {
  const runId = randomUUID()
  const lock = await acquireLock(runId)
  if (!lock) {
    await log(site, runId, 'SKIPPED_ALREADY_RUNNING')
    return
  }
  try {
    await log(site, runId, 'STARTED')
    const result = await withBrowser(async page => {
      try {
        return site === 'suape' ? await runSuape(page, runId) : await runRecife(page, runId)
      } catch (error) {
        await screenshot(page, site, runId, 'erro')
        throw error
      }
    })
    await log(site, runId, result)
  } catch (error) {
    await log(site, runId, 'FAILED', error instanceof Error ? error.message : String(error))
  } finally {
    await releaseLock(lock)
  }
}

async function main() {
  if (process.argv.includes('--once')) {
    const site = process.argv.at(-1)
    if (site !== 'suape' && site !== 'recife') throw new Error('Use --once suape ou --once recife')
    await execute(site)
    return
  }
  for (const site of ['suape', 'recife'] as const) {
    for (const expression of schedules[site]) {
      if (!cron.validate(expression)) throw new Error(`Cron inválido para ${site}: ${expression}`)
      cron.schedule(expression, () => { void execute(site) }, { timezone, noOverlap: true })
    }
    console.log(`[${site.toUpperCase()}] Agendador ativo: ${schedules[site].join(' | ')} (${timezone})`)
  }
}
void main().catch(error => { console.error(error); process.exitCode = 1 })
