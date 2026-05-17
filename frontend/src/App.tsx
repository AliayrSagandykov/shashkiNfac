import { Routes, Route, Navigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import Login from './pages/Login'
import Home from './pages/Home'
import Game from './pages/Game'
import Profile from './pages/Profile'
import Leaderboard from './pages/Leaderboard'
import News from './pages/News'
import Review from './pages/Review'
import { useAuthStore } from './store/authStore'
import { useProfileStore } from './store/profileStore'
import { getLang, subscribeLang } from './i18n'

export default function App() {
  const { user, loading, init } = useAuthStore()
  const { load: loadProfile, clear: clearProfile } = useProfileStore()
  const [lang, setLangState] = useState(getLang())

  useEffect(() => subscribeLang(setLangState), [])

  useEffect(() => {
    init()
  }, [init])

  useEffect(() => {
    if (!user || user.id.startsWith('guest-')) {
      clearProfile()
      return
    }
    void loadProfile(user.id)
  }, [user, loadProfile, clearProfile])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-app">
        <div className="text-fg text-xl">Loading...</div>
      </div>
    )
  }

  return (
    <Routes key={lang}>
      <Route path="/login" element={!user ? <Login /> : <Navigate to="/" />} />
      <Route path="/" element={user ? <Home /> : <Navigate to="/login" />} />
      <Route path="/profile" element={user ? <Profile /> : <Navigate to="/login" />} />
      <Route path="/u/:id" element={user ? <Profile /> : <Navigate to="/login" />} />
      <Route path="/leaderboard" element={user ? <Leaderboard /> : <Navigate to="/login" />} />
      <Route path="/news" element={user ? <News /> : <Navigate to="/login" />} />
      <Route path="/game/:gameId" element={<Game />} />
      <Route path="/review/:gameId" element={user ? <Review /> : <Navigate to="/login" />} />
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  )
}
