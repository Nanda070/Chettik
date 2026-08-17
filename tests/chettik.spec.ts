import { expect, test } from '@playwright/test'

async function login(page: import('@playwright/test').Page, email = 'test@test.com') {
  await page.goto('/')
  if (await page.getByRole('heading', { name: 'Scan from mobile Chettik' }).isVisible()) {
    await page.getByRole('button', { name: 'Log in using email' }).click()
    await page.getByRole('textbox', { name: 'Email address' }).fill(email)
    await page.getByRole('button', { name: 'Continue' }).click()
  } else {
    await page.getByRole('textbox', { name: 'Email address' }).fill(email)
    await page.getByRole('button', { name: /continue|продолжить/i }).click()
  }
  await page.getByRole('textbox', { name: 'OTP digit 1' }).fill('123456')
  await page.getByRole('button', { name: /sign in|verify|войти|подтвердить/i }).click()
}

test('QR-first authentication is polished and exposes six OTP cells', async ({ page }, testInfo) => {
  await page.goto('/')
  if (testInfo.project.name === 'desktop') {
    await expect(page.getByRole('heading', { name: 'Scan from mobile Chettik' })).toBeVisible()
    await expect(page.locator('.desktop-qr')).toBeVisible()
    await page.getByRole('button', { name: 'Log in using email' }).click()
  }
  await page.getByRole('textbox', { name: 'Email address' }).fill('test@test.com')
  await page.getByRole('button', { name: /continue|продолжить/i }).click()
  const cells = page.locator('.otp-cell:visible')
  await expect(cells).toHaveCount(6)
  await expect(cells.first()).toBeFocused()
  await cells.first().fill('123456')
  await expect(cells.nth(5)).toHaveValue('6')
})

test('new inbox creates direct chats, groups, channels and messages', async ({ page }, testInfo) => {
  await login(page, testInfo.project.name === 'mobile' ? 'test2@test.com' : 'test@test.com')
  await expect(page.getByText('No chats yet')).toBeVisible()
  await page.locator('.inbox-empty').getByRole('button', { name: 'New chat' }).click()
  await expect(page.getByRole('dialog', { name: 'Contacts' })).toBeVisible()
  await page.locator('.contacts-panel > div > button').first().click()
  await page.getByRole('textbox', { name: 'Message text' }).fill('A real local message')
  await page.getByRole('button', { name: 'Send message' }).click()
  await expect(page.getByText('A real local message')).toBeVisible()

  await page.getByRole('button', { name: 'Open main menu' }).click()
  await page.getByRole('button', { name: 'New group' }).click()
  await page.getByRole('textbox', { name: 'Group name' }).fill('Project team')
  await page.getByRole('button', { name: 'Create group' }).click()
  await expect(page.locator('.chat-head')).toContainText('Project team')

  await page.getByRole('button', { name: 'Open main menu' }).click()
  await page.getByRole('button', { name: 'New channel' }).click()
  await page.getByRole('textbox', { name: 'Channel name' }).fill('Release notes')
  await page.getByRole('textbox', { name: 'Channel handle' }).fill(`release_${Date.now()}`)
  await page.getByRole('button', { name: 'Create channel' }).click()
  await expect(page.locator('.chat-head')).toContainText('Release notes')
})
