import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { api } from './api'
import type { CurrentUser } from './types'
import ProtectedRoute from './components/ProtectedRoute'
import Layout from './components/Layout'
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import Attendance from './pages/Attendance'
import Reports from './pages/Reports'
import Students from './pages/Students'
import Staff from './pages/Staff'
import Settings from './pages/Settings'
import Notifications from './pages/Notifications'
import Subscription from './pages/Subscription'
import Platform from './pages/Platform'
import OwnerInsights from './pages/OwnerInsights'

export default function App() {
  const [user, setUser] = useState<CurrentUser | null>(null)
  const [loading, setLoading] = useState(!!localStorage.getItem('token'))

  async function refresh() {
    try {
      const response = await api.get('/me')
      setUser(response.data)
    } catch {
      setUser(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (localStorage.getItem('token')) void refresh()
  }, [])

  if (loading) {
    return <div className="center-screen"><Loader2 className="spin" size={28} /><span>در حال بارگذاری…</span></div>
  }

  return (
    <>
      <Routes>
        <Route path="/login" element={<Login onLogin={refresh} />} />
        <Route path="/register" element={<Register onLogin={refresh} />} />
        <Route path="/platform" element={
          <ProtectedRoute>{user?.role === 'platform_admin' ? <Platform /> : <Navigate to="/" />}</ProtectedRoute>
        } />
        <Route path="/owner/insights" element={
          <ProtectedRoute>{user?.role === 'platform_admin' ? <OwnerInsights /> : <Navigate to="/" />}</ProtectedRoute>
        } />
        <Route element={<ProtectedRoute>{user ? <Layout user={user} /> : <Navigate to="/login" />}</ProtectedRoute>}>
          <Route index element={user ? <Dashboard user={user} /> : null} />
          <Route path="attendance" element={user ? <Attendance user={user} /> : null} />
          <Route path="reports" element={<Reports />} />
          <Route path="students" element={<Students />} />
          <Route path="staff" element={<Staff />} />
          <Route path="settings" element={<Settings />} />
          <Route path="notifications" element={<Notifications />} />
          <Route path="subscription" element={<Subscription />} />
        </Route>
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </>
  )
}
