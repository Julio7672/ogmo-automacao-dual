import type { Page } from 'playwright'
import { clickText, requireEnv, screenshot, timeout, type Result } from '../shared/runtime.js'

async function chooseExtraYes(page: Page) {
  // Alguns portais antigos usam radio nativo; outros, botões estilizados.
  const yesRadio = page.getByRole('radio', { name: /^sim$/i })
  if (await yesRadio.count()) {
    await yesRadio.first().check()
    return
  }
  const yesLabel = page.getByText(/^sim$/i).first()
  await yesLabel.click({ timeout })
}

export async function runRecife(page: Page, runId: string): Promise<Result> {
  await page.goto(process.env.RECIFE_URL || 'http://www.ogmo-recife.org.br/EleicaoNet/Index.php?acao=Home', { waitUntil: 'domcontentloaded', timeout })
  // O portal mostra Matrícula, Senha e Entrar. Preferimos labels e recorremos à ordem se necessário.
  const user = page.getByLabel(/matrícula/i)
  const pass = page.getByLabel(/senha/i)
  const inputs = page.locator('input:not([type="hidden"]):not([type="submit"]):not([type="button"])')
  if (await user.count()) await user.first().fill(requireEnv('RECIFE_USER'))
  else await inputs.nth(0).fill(requireEnv('RECIFE_USER'))
  if (await pass.count()) await pass.first().fill(requireEnv('RECIFE_PASSWORD'))
  else await inputs.nth(1).fill(requireEnv('RECIFE_PASSWORD'))
  await clickText(page, 'Entrar')
  await clickText(page, 'EscalaNet')
  await clickText(page, 'Escala de Estiva')
  // A tela da escala pode não estar aberta em todos os horários; não clicar em salvar se não existir.
  const markAll = page.getByText(/marcar\s*tudo/i).first()
  if (!(await markAll.isVisible().catch(() => false))) {
    await screenshot(page, 'recife', runId, 'sem-escala')
    return 'NO_OPEN_CALL'
  }
  if (process.env.RECIFE_DRY_RUN !== 'false') {
    await screenshot(page, 'recife', runId, 'antes-selecionar')
    console.log('[RECIFE] DRY_RUN ativo: nenhuma escolha foi alterada')
    return 'DRY_RUN'
  }
  await markAll.click({ timeout })
  await chooseExtraYes(page)
  await screenshot(page, 'recife', runId, 'antes-salvar')
  await clickText(page, 'Salvar Escolhas')
  await page.waitForTimeout(1500)
  await screenshot(page, 'recife', runId, 'apos-salvar')
  // Não há evidência ainda do texto/elemento de confirmação do portal.
  // Portanto, não declarar sucesso sem validação posterior.
  return 'SAVED_UNVERIFIED'
}
