import { Routes, Route, Navigate } from 'react-router-dom'
import { useEffect } from 'react'
import Login from './pages/Login'
import Home from './pages/Home'
import Game from './pages/Game'
import { useAuthStore } from './store/authStore'

export default function App() {
  const { user, loading, init } = useAuthStore()

  useEffect(() => {
    init()
  }, [init])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-white text-xl">Loading...</div>
      </div>
    )
  }

  return (
    <Routes>
      <Route path="/login" element={!user ? <Login /> : <Navigate to="/" />} />
      <Route path="/" element={user ? <Home /> : <Navigate to="/login" />} />
      <Route path="/game/:gameId" element={<Game />} />
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  )
}
