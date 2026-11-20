import { mkdir, appendFile } from 'node:fs/promises'
import path from 'node:path'
import { chromium, type Browser, type Page } from 'playwright'

export type Site = 'suape' | 'recife'
export type Result = 'NO_OPEN_CALL' | 'SELECTION_CLICKED' | 'SAVED_CONFIRMED' | 'SAVED_UNVERIFIED' | 'DRY_RUN'
export const timezone = process.env.TZ || 'America/Sao_Paulo'
export const timeout = Number(process.env.TIMEOUT_MS || 30000)
export const stepDelay = Number(process.env.STEP_DELAY_MS || 5000)
const logDir = path.resolve(process.env.LOG_DIR || 'logs')
const screenshotDir = path.resolve(process.env.SCREENSHOT_DIR || 'artifacts')

export async function log(site: Site, runId: string, status: string, details?: string) {
  await mkdir(logDir, { recursive: true })
  const event = { timestamp: new Date().toISOString(), site, runId, status, ...(details ? { details } : {}) }
  console.log(JSON.stringify(event))
  await appendFile(path.join(logDir, 'events.jsonl'), JSON.stringify(event) + '\n')
}

export async function screenshot(page: Page, site: Site, runId: string, label: string) {
  try {
    await mkdir(screenshotDir, { recursive: true })
    await page.screenshot({ path: path.join(screenshotDir, `${site}-${runId}-${label}.png`), fullPage: true, timeout: 10000 })
  } catch (error) {
    console.warn(`[${site}] Screenshot não disponível: ${String(error)}`)
  }
}

export async function withBrowser<T>(fn: (page: Page) => Promise<T>): Promise<T> {
  let browser: Browser | undefined
  try {
    browser = await chromium.launch({ headless: process.env.HEADLESS !== 'false', args: ['--disable-dev-shm-usage'] })
    const context = await browser.newContext({ locale: 'pt-BR', viewport: { width: 1366, height: 768 } })
    const page = await context.newPage()
    page.setDefaultTimeout(timeout)
    return await fn(page)
  } finally {
    await browser?.close().catch(() => {})
  }
}

export async function clickText(page: Page, label: string) {
  const pattern = new RegExp(`^\\s*${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`, 'i')
  const element = page.getByRole('button', { name: pattern })
    .or(page.getByRole('link', { name: pattern }))
    .or(page.getByText(pattern))
    .first()
  await element.click({ timeout })
}

export function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Configure ${name} no .env`)
  return value
}
