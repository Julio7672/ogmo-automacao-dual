import type { Page } from 'playwright'
import { clickText, requireEnv, screenshot, stepDelay, timeout, type Result } from '../shared/runtime.js'

const closedText = /NÃO TEM CHAMADA ABERTA!/i
async function closed(page: Page): Promise<boolean> {
  return page.getByText(closedText).first().isVisible().catch(() => false)
}
async function waitOrClosed(page: Page): Promise<boolean> {
  const end = Date.now() + stepDelay
  while (Date.now() < end) {
    if (await closed(page)) return true
    await page.waitForTimeout(Math.min(500, Math.max(1, end - Date.now())))
  }
  return closed(page)
}

export async function runSuape(page: Page, runId: string): Promise<Result> {
  await page.goto(process.env.OGMO_URL || 'http://tpa.ogmosuape.com.br/login', { waitUntil: 'domcontentloaded', timeout })
  const inputs = page.locator('input:not([type="hidden"]):not([type="submit"])')
  await inputs.nth(0).fill(requireEnv('OGMO_USER'))
  await inputs.nth(1).fill(requireEnv('OGMO_PASSWORD'))
  await clickText(page, 'confirmar')
  await page.waitForURL('**/inicio', { timeout })
  console.log('[SUAPE] Login realizado')
  await clickText(page, 'escalar-se')
  await page.waitForURL('**/escalacao', { timeout })
  if (await closed(page) || await waitOrClosed(page)) {
    await screenshot(page, 'suape', runId, 'sem-chamada')
    return 'NO_OPEN_CALL'
  }
  await clickText(page, 'ESTIVADOR')
  if (await closed(page) || await waitOrClosed(page)) {
    await screenshot(page, 'suape', runId, 'sem-chamada')
    return 'NO_OPEN_CALL'
  }
  await clickText(page, 'selecionar tudo')
  await page.waitForTimeout(1000)
  await screenshot(page, 'suape', runId, 'apos-selecionar')
  return 'SELECTION_CLICKED'
}
