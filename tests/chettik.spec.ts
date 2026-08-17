import { expect, test, type APIRequestContext, type Page } from '@playwright/test'

const API = 'http://127.0.0.1:8788/api'

async function login(page: Page) {
  await page.goto('/')
  await page.evaluate(() => localStorage.clear())
  await page.goto('/')
  if (await page.getByRole('heading', { name: 'Scan from mobile Chettik' }).isVisible().catch(() => false)) {
    await page.getByRole('button', { name: 'Log in using email' }).click()
  }
  await page.getByRole('textbox', { name: 'Email address' }).fill('turkapahf@gmail.com')
  await page.getByRole('button', { name: /continue/i }).click()
  await page.getByRole('textbox', { name: 'OTP digit 1' }).fill('123456')
  await page.getByRole('button', { name: /sign in|verify/i }).click()
  await expect(page.locator('.app-shell')).toBeVisible()
}

async function createSearchablePerson(request: APIRequestContext) {
  const suffix = `${Date.now()}`
  const email = `playwright-${suffix}@example.test`
  const username = `playwright_${suffix}`
  const challenge = await request.post(`${API}/auth/otp/request`, { data: { email, mode: 'signup' } })
  expect(challenge.ok()).toBeTruthy()
  const verified = await request.post(`${API}/auth/otp/verify`, {
    data: { email, code: '123456', challengeId: (await challenge.json()).challengeId, name: `Playwright ${suffix}`, username },
  })
  expect(verified.ok()).toBeTruthy()
  return { username: `@${username}`, name: `Playwright ${suffix}` }
}

async function openSavedMessages(page: Page) {
  if (await page.getByRole('textbox', { name: 'Message text' }).isVisible().catch(() => false)) return
  const sidebarSaved = page.locator('.sidebar .chat-row').filter({ hasText: 'Saved Messages' })
  if (await sidebarSaved.isVisible().catch(() => false)) {
    await sidebarSaved.click()
    return
  }
  await page.getByRole('button', { name: 'Open main menu' }).click()
  await page.locator('.main-menu').getByRole('button', { name: 'Saved messages', exact: true }).click()
}

test('Saved Messages opens and sends a self message', async ({ page }) => {
  await login(page)
  await openSavedMessages(page)
  await expect(page.getByRole('textbox', { name: 'Message text' })).toBeVisible()
  const message = `saved-${Date.now()}`
  await page.getByRole('textbox', { name: 'Message text' }).fill(message)
  await page.getByRole('button', { name: 'Send message' }).click()
  await expect(page.locator('.messages')).toContainText(message)
})

test('searches a username and adds a contact', async ({ page, request }) => {
  const person = await createSearchablePerson(request)
  await login(page)
  await page.getByLabel('New chat').click()
  const contacts = page.getByRole('dialog', { name: 'Contacts' })
  await expect(contacts).toBeVisible()
  await contacts.getByRole('textbox', { name: 'Search people' }).fill(person.username)
  await expect(contacts.getByText(person.name).first()).toBeVisible()
  await contacts.getByRole('button', { name: `Add ${person.name}`, exact: true }).click()
  await expect(contacts.getByText('Your contacts')).toBeVisible()
  await contacts.getByText(person.name).last().click()
  await expect(page.getByRole('textbox', { name: 'Message text' })).toBeVisible()
})

test('uploads and previews a profile photo', async ({ page }, testInfo) => {
  await login(page)
  if (testInfo.project.name === 'mobile') {
    await openSavedMessages(page)
    await page.getByRole('button', { name: 'Profile', exact: true }).click()
  } else {
    await page.getByRole('button', { name: 'Open my profile' }).click()
  }
  await page.locator('.tg-profile').click()
  const image = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLTOQAAAABJRU5ErkJggg==', 'base64')
  await page.getByLabel('Profile photo').setInputFiles({ name: 'avatar.png', mimeType: 'image/png', buffer: image })
  await expect(page.locator('.edit-avatar img')).toBeVisible()
})
