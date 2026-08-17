import { expect, test } from '@playwright/test'

async function login(page: import('@playwright/test').Page, name: 'Nanda' | 'Mark' | 'Alisher' = 'Nanda') {
  await page.goto('/')
  if (await page.getByRole('heading', { name: 'Scan From Mobile Chettik' }).isVisible()) {
    await page.getByRole('button', { name: 'Log in using phone number' }).click()
    await page.getByRole('button', { name, exact: true }).click()
    await page.getByRole('textbox', { name: 'Desktop OTP' }).fill('123456')
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page.locator('.chat-head .chat-person strong')).toBeVisible()
    return
  }
  await page.getByRole('button', { name: new RegExp(name) }).click()
  await page.getByRole('textbox').fill('123456')
  await page.getByRole('button', { name: /verify|подтвердить/i }).click()
  await expect(page.locator('.chat-head .chat-person strong')).toBeVisible()
}

test('seed account sends and edits inside the composer', async ({ page }) => {
  await login(page)
  await page.getByRole('textbox', { name: 'Message text' }).fill('A polished local message')
  await page.getByRole('button', { name: 'Send message' }).click()
  await expect(page.getByText('A polished local message').last()).toBeVisible()
  await page.getByRole('button', { name: 'Edit message' }).last().click()
  await expect(page.getByText('Edit message')).toBeVisible()
  await page.getByRole('textbox', { name: 'Message text' }).fill('Edited without browser dialogs')
  await page.getByRole('button', { name: 'Save message' }).click()
  await expect(page.getByText('Edited without browser dialogs').last()).toBeVisible()
})

test('settings privacy, devices, language and theme work', async ({ page }, testInfo) => {
  await login(page)
  if (testInfo.project.name === 'mobile') await page.locator('.mobile-nav button').last().click()
  else { await page.getByRole('button', { name: 'Open main menu' }).click(); await page.locator('.main-menu').getByRole('button', { name: 'Settings', exact: true }).click() }
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
  test.skip(testInfo.project.name === 'desktop', 'Desktop uses QR-first login; legal links remain in mobile auth')
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

test('rich messaging delivers held voice and circle recordings, polls and location', async ({ page }) => {
  await login(page)
  const voiceButton = page.getByRole('button', { name: /Voice mode/ })
  await voiceButton.click()
  const circleButton = page.locator('.voice-button')
  await circleButton.dispatchEvent('pointerdown')
  await page.waitForTimeout(220)
  await expect(page.getByRole('button', { name: /Release to send video circle/ })).toBeVisible()
  await circleButton.dispatchEvent('pointerup')
  await expect(page.getByText('A quiet moment from the studio')).toBeVisible()
  await page.getByRole('button', { name: /Circle mode/ }).click()
  await page.getByRole('button', { name: /Voice mode/ }).dispatchEvent('pointerdown')
  await page.waitForTimeout(220)
  await page.getByRole('button', { name: /Release to send voice message/ }).dispatchEvent('pointerup')
  await expect(page.getByText('0:08', { exact: true })).toBeVisible()

  await page.getByRole('button', { name: 'Open rich message tools' }).click()
  await page.getByText('Poll', { exact: true }).click()
  await page.getByRole('button', { name: 'Create poll' }).click()
  await expect(page.getByText('Team sync at 15:00?', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: /Yes, works for me/ }).click()

  await page.getByRole('button', { name: 'Open rich message tools' }).click()
  await page.getByText('Location', { exact: true }).click()
  await page.getByRole('button', { name: 'Share location' }).click()
  await expect(page.getByText('Moscow Avenue · precise location')).toBeVisible()

  await page.getByRole('button', { name: 'Open rich message tools' }).click()
  await expect(page.getByText('Video circle', { exact: true })).toHaveCount(0)
})

test('stories and privacy-first delivery controls work', async ({ page }, testInfo) => {
  await login(page)
  if (testInfo.project.name === 'mobile') {
    await page.locator('.mobile-nav button').last().click()
  } else {
    await page.getByRole('button', { name: 'Open main menu' }).click()
    await page.locator('.main-menu').getByRole('button', { name: 'Settings', exact: true }).click()
  }
  await page.getByText('Delivery and notifications', { exact: true }).click()
  await expect(page.getByText('Quiet. Only what matters.')).toBeVisible()
  await page.getByRole('button', { name: /Push notifications/i }).click()
  await page.getByRole('dialog', { name: 'Delivery and privacy' }).getByLabel('Close settings').click()
  await page.getByRole('button', { name: 'Close settings' }).click()
  if (testInfo.project.name === 'mobile') await page.locator('.mobile-stories .story').first().click()
  else await page.locator('.sidebar .story').first().click()
  await expect(page.getByText('This story disappears in 24 hours')).toBeVisible()
  await page.getByRole('button', { name: 'Close story' }).click()
})

test('telegram main menu routes supported Stage 4 entries', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Desktop menu only')
  await login(page)
  await page.getByRole('button', { name: 'Open main menu' }).click()
  await expect(page.getByText('Chettik Web · v0.5')).toBeVisible()
  await expect(page.getByText('Wallet', { exact: true })).toHaveCount(0)
  await page.getByText('New Group', { exact: true }).click()
  await expect(page.getByRole('heading', { name: 'New Group' })).toBeVisible()
  await page.getByRole('button', { name: 'Back to main menu' }).click()
  await page.getByText('Night Mode', { exact: true }).click()
  await expect(page.locator('.app')).not.toHaveClass(/dark/)
  await page.locator('.main-menu').getByRole('button', { name: 'Settings', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Settings' })).toBeVisible()
})

test('my profile and saved messages target the signed-in account', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Desktop menu only')
  await login(page, 'Nanda')
  await page.getByRole('button', { name: 'Open main menu' }).click()
  await page.getByRole('button', { name: 'My Profile', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Nanda profile' })).toBeVisible()
  await page.getByRole('button', { name: 'Close profile' }).click()

  await page.getByRole('button', { name: 'Open main menu' }).click()
  await page.getByRole('button', { name: 'Saved Messages', exact: true }).click()
  await expect(page.locator('.chat-row.active')).toContainText('Saved Messages')
  await expect(page.getByText('Messages saved for yourself')).toBeVisible()
  await expect(page.locator('.messages .message')).toContainText('Remember to write this down.')
})

test('phone privacy Nobody removes the Mobile row for viewers', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Desktop profile treatment')
  await page.goto('/')
  await page.evaluate(() => {
    const key = 'chettik-stage-2'
    const data = JSON.parse(localStorage.getItem(key) || '{}')
    data.profile = { ...data.profile, '+22222222222': { ...(data.profile?.['+22222222222'] || {}), privacy: { ...(data.profile?.['+22222222222']?.privacy || {}), phone: 'Nobody' } } }
    localStorage.setItem(key, JSON.stringify(data))
  })
  await login(page, 'Nanda')
  await page.getByRole('button', { name: 'Open Mark profile' }).first().click()
  await expect(page.getByRole('dialog', { name: 'Mark profile' }).getByText('Mobile', { exact: true })).toHaveCount(0)
})

test('profile, confirmations and chat context actions are interactive', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Context menus are desktop treatment')
  await login(page)
  await page.getByRole('button', { name: 'Open Mark profile' }).first().click()
  await expect(page.getByRole('dialog', { name: 'Mark profile' })).toBeVisible()
  await page.getByRole('button', { name: 'More profile actions' }).click()
  await expect(page.getByText('Export chat', { exact: true })).toBeVisible()
  await page.getByText('Block user', { exact: true }).last().click()
  await expect(page.getByRole('dialog', { name: 'Block Mark?' })).toBeVisible()
  await page.getByRole('button', { name: 'Cancel' }).click()

  await page.locator('.sidebar .chat-row').first().click({ button: 'right' })
  await expect(page.getByRole('menu')).toBeVisible()
  await page.getByText('Pin', { exact: true }).click()
  await expect(page.locator('.sidebar .chat-row svg')).toHaveCount(1)
  await page.locator('.message').first().click({ button: 'right' })
  await expect(page.getByText('Copy text', { exact: true })).toBeVisible()
  await page.getByText('Forward', { exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Forward to' })).toBeVisible()
  await page.getByText('Saved Messages', { exact: true }).click()

  await page.getByRole('button', { name: 'Report message' }).first().click()
  await expect(page.getByRole('dialog', { name: 'Report message?' })).toBeVisible()
  await page.getByRole('dialog', { name: 'Report message?' }).getByRole('button', { name: 'Report', exact: true }).click()

  await page.getByRole('button', { name: 'Open main menu' }).click()
  await page.getByRole('button', { name: 'Saved Messages', exact: true }).click()
  await expect(page.locator('.messages .message').filter({ hasText: 'I tried the new onboarding flow.' })).toBeVisible()
})
