import type { ReactNode } from 'react'
import { BrandMark } from './ui'

export default function AuthShell({ children }: { children: ReactNode; wide?: boolean }) {
  return (
    <div className="auth-layout">
      <aside className="auth-aside">
        <div className="auth-lockup">
          <BrandMark size={68} />
          <b className="auth-brand-name">FASTICK</b>
          <p className="auth-slogan">با فستیک، یه تیک جلوتر از بقیه باش!</p>
          <small>سامانه هوشمند حضور و غیاب مدارس</small>
        </div>
      </aside>
      <main className="auth-main">{children}</main>
    </div>
  )
}
