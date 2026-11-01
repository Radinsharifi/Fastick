export type InstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

let deferredPrompt: InstallPromptEvent | null = null
let installed = false
const listeners = new Set<() => void>()

function notify() {
  listeners.forEach(listener => listener())
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault()
    deferredPrompt = event as InstallPromptEvent
    notify()
  })
  window.addEventListener('appinstalled', () => {
    installed = true
    deferredPrompt = null
    notify()
  })
}

export function getInstallPromptState() {
  return { prompt: deferredPrompt, installed }
}

export function subscribeInstallPrompt(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export async function showInstallPrompt() {
  if (!deferredPrompt) return null
  const prompt = deferredPrompt
  await prompt.prompt()
  const choice = await prompt.userChoice
  deferredPrompt = null
  notify()
  return choice
}
