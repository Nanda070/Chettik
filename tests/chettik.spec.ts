import { expect, test } from '@playwright/test'

async function login(page: import('@playwright/test').Page, name: 'Nanda' | 'Mark' | 'Alisher' = 'Nanda') {
  await page.goto('/')
  await page.getByRole('button', { name: new RegExp(name) }).click()
  await page.getByRole('textbox').fill('123456')
  await page.getByRole('button', { name: /verify|подтвердить/i }).click()
  await expect(page.getByText('Mark', { exact: true }).first()).toBeVisible()
}

test('seed account sends and edits inside the composer', async ({ page }) => {
  await login(page)
  await page.getByRole('textbox', { name: 'Message text' }).fill('A polished local message')
  await page.getByRole('button', { name: 'Send message' }).click()
  await expect(page.getByText('A polished local message')).toBeVisible()
  await page.getByRole('button', { name: 'Edit message' }).last().click()
  await expect(page.getByText('Edit message')).toBeVisible()
  await page.getByRole('textbox', { name: 'Message text' }).fill('Edited without browser dialogs')
  await page.getByRole('button', { name: 'Save message' }).click()
  await expect(page.getByText('Edited without browser dialogs')).toBeVisible()
})

test('settings privacy, devices, language and theme work', async ({ page }, testInfo) => {
  await login(page)
  if (testInfo.project.name === 'mobile') await page.locator('.mobile-nav button').last().click()
  else await page.getByTitle('Settings').click()
  await page.getByText('Privacy and Security', { exact: true }).click()
  await page.getByText('Last seen & online', { exact: true }).click()
  await page.getByText('Nobody', { exact: true }).click()
  await page.getByRole('button', { name: 'Back' }).click()
  await page.getByText('Devices', { exact: true }).click()
  await expect(page.getByText('Windows • Chrome')).toBeVisible()
  await page.getByRole('button', { name: 'Back' }).click()
  await page.getByText('Appearance', { exact: true }).click()
  await page.getByText('Light', { exact: true }).click()
  await page.getByRole('button', { name: 'Back' }).click()
  await page.getByText('Language', { exact: true }).click()
  await expect(page.locator('.tg-panel-head strong')).toHaveText('Settings')
})

test('admin and legal flows are reachable for permitted roles', async ({ page }, testInfo) => {
  await login(page, 'Mark')
  if (testInfo.project.name === 'desktop') {
    await page.getByTitle('Operations console').click()
    await expect(page.getByText('Moderation console')).toBeVisible()
  }
  await page.goto('/')
  await page.getByText('Terms', { exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Terms of Service' })).toBeVisible()
  await page.goto('/')
  await page.getByText('Privacy', { exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Privacy Policy' })).toBeVisible()
  await page.goto('/')
  await page.getByText('Authors', { exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Authors & Credits' })).toBeVisible()
})

test('mobile layout opens settings and emoji panel', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', 'Mobile viewport only')
  await login(page, 'Alisher')
  await page.getByRole('button', { name: 'Open emoji picker' }).click()
  await expect(page.getByText('Stickers', { exact: true })).toBeVisible()
  await page.locator('.mobile-nav button').last().click()
  await expect(page.getByText('Privacy and Security', { exact: true })).toBeVisible()
})
