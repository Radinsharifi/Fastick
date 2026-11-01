import { useEffect, useState } from 'react'
import { Download, HelpCircle, X } from 'lucide-react'
import { getInstallPromptState, showInstallPrompt, subscribeInstallPrompt } from '../lib/installPrompt'

const DISMISSED_KEY = 'fastick-install-dismissed-until'
const WEEK = 7 * 24 * 60 * 60 * 1000

function isStandalone(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches
    || ('standalone' in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone))
}

export default function InstallReminder() {
  const [visible, setVisible] = useState(false)
  const [prompt, setPrompt] = useState(() => getInstallPromptState().prompt)
  const [showGuide, setShowGuide] = useState(false)
  const [isIos, setIsIos] = useState(false)

  useEffect(() => {
    setIsIos(/iPad|iPhone|iPod/.test(navigator.userAgent) && !('MSStream' in window))
    if (isStandalone()) return

    const dismissedUntil = Number(localStorage.getItem(DISMISSED_KEY) || 0)
    if (dismissedUntil > Date.now()) return

    const timer = window.setTimeout(() => setVisible(true), 2500)
    const syncPrompt = () => {
      const state = getInstallPromptState()
      setPrompt(state.prompt)
      if (state.installed) {
        setVisible(false)
        localStorage.setItem(DISMISSED_KEY, String(Date.now() + 365 * WEEK))
      }
    }
    const unsubscribe = subscribeInstallPrompt(syncPrompt)
    syncPrompt()
    return () => {
      window.clearTimeout(timer)
      unsubscribe()
    }
  }, [])

  function dismiss() {
    setVisible(false)
    localStorage.setItem(DISMISSED_KEY, String(Date.now() + WEEK))
  }

  async function install() {
    if (!prompt) {
      setShowGuide(value => !value)
      return
    }
    try {
      const choice = await showInstallPrompt()
      setPrompt(getInstallPromptState().prompt)
      if (choice?.outcome === 'accepted') {
        setVisible(false)
        localStorage.setItem(DISMISSED_KEY, String(Date.now() + 365 * WEEK))
      } else if (choice?.outcome === 'dismissed') {
        setShowGuide(true)
      }
    } catch {
      setShowGuide(true)
    }
  }

  if (!visible) return null

  return (
    <aside className="install-reminder" aria-label="نصب فستیک">
      <button type="button" className="icon-btn install-reminder-close" aria-label="بعداً یادآوری کن" onClick={dismiss}>
        <X size={16} />
      </button>
      <div className="install-reminder-copy">
        <b>فستیک همیشه دم دست شما</b>
        <p>برای استفاده‌ی راحت‌تر، اپلیکیشن را به صفحه‌ی اصلی موبایل یا دسکتاپ اضافه کنید.</p>
        {showGuide && (
          <p className="install-reminder-guide">
            {isIos
              ? 'در Safari روی «sharing» بزنید و «add to home screen» را انتخاب کنید.'
              : 'از منوی مرورگر گزینه‌ی «install app» یا «add to home screen» را انتخاب کنید. اگر این گزینه نیست، مرورگر شما نصب مستقیم را پشتیبانی نمی‌کند.'}
          </p>
        )}
      </div>
      <button type="button" className="btn btn-primary btn-sm install-reminder-action" onClick={install}>
        {prompt ? <Download size={16} aria-hidden /> : <HelpCircle size={16} aria-hidden />}
        {prompt ? 'افزودن' : showGuide ? 'بستن راهنما' : 'راهنمای نصب'}
      </button>
    </aside>
  )
}
