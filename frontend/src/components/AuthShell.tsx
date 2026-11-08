import type { ReactNode } from 'react'
import { BrandMark } from './ui'

export default function AuthShell({ children, intro }: { children: ReactNode; wide?: boolean; intro?: ReactNode }) {
  return (
    <div className={`auth-layout${intro ? ' auth-layout-with-intro' : ''}`}>
      <aside className="auth-aside">
        <div className="auth-lockup">
          <BrandMark size={68} />
          <b className="auth-brand-name">FASTICK</b>
          <p className="auth-slogan">با فستیک، یه تیک جلوتر از بقیه باش!</p>
          <small>سامانه هوشمند حضور و غیاب مدارس</small>
        </div>
        {intro && <div className="auth-intro">{intro}</div>}
      </aside>
      <main className="auth-main">{children}</main>
    </div>
  )
}
