import { expect, test, type APIRequestContext, type Page } from '@playwright/test'

async function wipeInbox(request: APIRequestContext, email: string) {
  const otp = await request.post('http://127.0.0.1:8787/api/auth/otp/request', { data: { email } })
  expect(otp.ok()).toBeTruthy()
  const { challengeId } = await otp.json()
  const verify = await request.post('http://127.0.0.1:8787/api/auth/otp/verify', {
    data: { email, code: '123456', challengeId, deviceLabel: 'Playwright' },
  })
  expect(verify.ok()).toBeTruthy()
  const { token } = await verify.json()
  const reset = await request.post('http://127.0.0.1:8787/api/dev/reset-inbox', {
    headers: { Authorization: `Bearer ${token}` },
  })
  expect(reset.ok()).toBeTruthy()
}

async function login(page: Page, email = 'test@test.com') {
  await page.goto('/')
  await page.evaluate(() => localStorage.clear())
  await page.goto('/')
  if (await page.getByRole('heading', { name: 'Scan from mobile Chettik' }).isVisible().catch(() => false)) {
    await page.getByRole('button', { name: 'Log in using email' }).click()
  }
  await page.getByRole('textbox', { name: 'Email address' }).fill(email)
  await page.getByRole('button', { name: /continue|продолжить/i }).click()
  await page.getByRole('textbox', { name: 'OTP digit 1' }).fill('123456')
  await page.getByRole('button', { name: /sign in|verify|войти|подтвердить/i }).click()
  await expect(page.locator('.app-shell')).toBeVisible()
}

async function openNewChat(page: Page, mobile: boolean) {
  if (mobile) {
    await page.locator('.chat-list-empty').getByRole('button', { name: 'New chat' }).click()
  } else {
    await page.locator('.inbox-empty').getByRole('button', { name: 'New chat' }).click()
  }
}

test('QR-first authentication is polished and exposes six OTP cells', async ({ page }, testInfo) => {
  await page.goto('/')
  await page.evaluate(() => localStorage.clear())
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

test('new inbox creates direct chats, groups, channels and messages', async ({ page, context, request }, testInfo) => {
  const mobile = testInfo.project.name === 'mobile'
  const email = mobile ? 'test2@test.com' : 'test3@test.com'
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await wipeInbox(request, email)
  await login(page, email)

  if (mobile) {
    await expect(page.locator('.app-shell.inbox-empty-state')).toBeVisible()
    await expect(page.locator('.sidebar')).toBeVisible()
    await expect(page.locator('.chat-list-empty')).toBeVisible()
    await expect(page.getByText('No conversations yet')).toBeVisible()
    await expect(page.locator('.inbox-empty-state .chat')).toHaveCSS('display', 'none')
  } else {
    await expect(page.locator('.inbox-empty')).toBeVisible()
    await expect(page.getByText('No chats yet')).toBeVisible()
    await expect(page.locator('.sidebar .chat-row').filter({ hasText: 'Saved Messages' })).toBeVisible()
  }

  await openNewChat(page, mobile)
  await expect(page.getByRole('dialog', { name: 'Contacts' })).toBeVisible()
  await page.locator('.contacts-panel > div > button').first().click()
  await expect(page.getByRole('textbox', { name: 'Message text' })).toBeVisible()
  const message = `hello-${Date.now()}`
  await page.getByRole('textbox', { name: 'Message text' }).fill(message)
  await page.getByRole('button', { name: 'Send message' }).click()
  await expect(page.locator('.messages .bubble').getByText(message)).toBeVisible()

  await page.getByRole('button', { name: 'Open main menu' }).first().click()
  await page.getByRole('button', { name: 'New group' }).click()
  const groupName = `Team ${Date.now()}`
  await page.getByRole('textbox', { name: 'Group name' }).fill(groupName)
  await page.getByRole('button', { name: 'Create group' }).click()
  await expect(page.locator('.chat-head')).toContainText(groupName)
  await page.getByRole('button', { name: 'Open group info' }).click()
  await expect(page.getByRole('dialog', { name: new RegExp(`${groupName} group info`) })).toBeVisible()
  await page.getByRole('button', { name: 'Close group info' }).click()

  await page.getByRole('button', { name: 'Open main menu' }).first().click()
  await page.getByRole('button', { name: 'New channel' }).click()
  const channelName = `Notes ${Date.now()}`
  const handle = `notes_${Date.now()}`
  await page.getByRole('textbox', { name: 'Channel name' }).fill(channelName)
  await page.getByRole('textbox', { name: 'Channel handle' }).fill(handle)
  await page.getByRole('button', { name: 'Create channel' }).click()
  await expect(page.locator('.chat-head')).toContainText(channelName)
  await page.getByRole('button', { name: 'Open channel info' }).first().click()
  await expect(page.getByRole('dialog', { name: new RegExp(`${channelName} channel info`) })).toBeVisible()
  await page.getByRole('button', { name: 'Invite link' }).click()
  await expect(page.getByText('Invite link ready')).toBeVisible()
  await page.locator('.invite-link').click()
  await expect(page.getByText('Invite link copied')).toBeVisible()
})
