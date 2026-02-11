import React, { Suspense, lazy, useEffect, useState } from 'react'
import { HashRouter as Router, Navigate, NavLink, Route, Routes } from 'react-router-dom'
import { CalendarClock, Camera, House, MessageCircle, UserCircle2 } from 'lucide-react'
import PasscodeLock from './components/PasscodeLock'
import AuthGateway from './components/AuthGateway'
import { AccountProfile, CoupleAvatarMap, ensureAccountProfile, getCoupleAvatarMap } from './services/accountService'
import { isPhoneAuthenticated, signOutPhoneAuth } from './services/authService'

const ChatPage = lazy(() => import('./pages/ChatPage'))
const AnniversaryPage = lazy(() => import('./pages/AnniversaryPage'))
const HomePage = lazy(() => import('./pages/HomePage'))
const PhotoWallPage = lazy(() => import('./pages/PhotoWallPage'))
const ProfilePage = lazy(() => import('./pages/ProfilePage'))

const TabBar: React.FC = () => (
  <nav className="ios-tabbar ios-blur ios-safe-bottom">
    <div className="flex justify-around items-center px-1.5 pt-2 pb-2">
      <NavLink
        to="/"
        className={({ isActive }) =>
          `ios-tab-item flex flex-col items-center gap-1 transition-colors ${isActive ? 'active text-rose-500' : 'text-gray-400'}`
        }
      >
        <MessageCircle size={22} />
        <span className="text-[10px] font-semibold">聊天</span>
      </NavLink>
      <NavLink
        to="/anniversary"
        className={({ isActive }) =>
          `ios-tab-item flex flex-col items-center gap-1 transition-colors ${isActive ? 'active text-rose-500' : 'text-gray-400'}`
        }
      >
        <CalendarClock size={22} />
        <span className="text-[10px] font-semibold">纪念日</span>
      </NavLink>
      <NavLink
        to="/home"
        className={({ isActive }) =>
          `ios-tab-item flex flex-col items-center gap-1 transition-colors ${isActive ? 'active text-rose-500' : 'text-gray-400'}`
        }
      >
        <House size={22} />
        <span className="text-[10px] font-semibold">家园</span>
      </NavLink>
      <NavLink
        to="/photos"
        className={({ isActive }) =>
          `ios-tab-item flex flex-col items-center gap-1 transition-colors ${isActive ? 'active text-rose-500' : 'text-gray-400'}`
        }
      >
        <Camera size={22} />
        <span className="text-[10px] font-semibold">照片墙</span>
      </NavLink>
      <NavLink
        to="/profile"
        className={({ isActive }) =>
          `ios-tab-item flex flex-col items-center gap-1 transition-colors ${isActive ? 'active text-rose-500' : 'text-gray-400'}`
        }
      >
        <UserCircle2 size={22} />
        <span className="text-[10px] font-semibold">主页</span>
      </NavLink>
    </div>
  </nav>
)

const AppContent: React.FC = () => {
  const [authLoading, setAuthLoading] = useState(true)
  const [phoneAuthed, setPhoneAuthed] = useState(false)
  const [isLocked, setIsLocked] = useState(true)
  const [accountLoading, setAccountLoading] = useState(false)
  const [account, setAccount] = useState<AccountProfile | null>(null)
  const [avatarMap, setAvatarMap] = useState<CoupleAvatarMap>({})
  const [startupError, setStartupError] = useState('')
  const [accountRetrySeed, setAccountRetrySeed] = useState(0)

  useEffect(() => {
    let active = true

    isPhoneAuthenticated()
      .then(authed => {
        if (active) {
          setPhoneAuthed(authed)
        }
      })
      .catch(() => {
        if (active) {
          setPhoneAuthed(false)
        }
      })
      .finally(() => {
        if (active) {
          setAuthLoading(false)
        }
      })

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (isLocked || !phoneAuthed) {
      return
    }

    let active = true

    const bootstrap = async () => {
      try {
        setAccountLoading(true)
        setStartupError('')

        const profile = await ensureAccountProfile()
        const map = await getCoupleAvatarMap()

        if (!active) {
          return
        }

        setAccount(profile)
        setAvatarMap(map)
      } catch (err) {
        if (!active) {
          return
        }

        setStartupError(err instanceof Error ? err.message : '初始化失败')
        setAccount(null)
      } finally {
        if (active) {
          setAccountLoading(false)
        }
      }
    }

    bootstrap()

    return () => {
      active = false
    }
  }, [accountRetrySeed, isLocked, phoneAuthed])

  if (authLoading) {
    return <div className="ios-page min-h-screen flex items-center justify-center text-gray-500">登录状态检查中...</div>
  }

  if (!phoneAuthed) {
    return <AuthGateway onAuthed={() => setPhoneAuthed(true)} />
  }

  if (isLocked) {
    return <PasscodeLock onSuccess={() => setIsLocked(false)} />
  }

  if (accountLoading) {
    return <div className="ios-page min-h-screen flex items-center justify-center text-gray-500">账号初始化中...</div>
  }

  if (!account) {
    return (
      <div className="ios-page min-h-screen flex items-center justify-center p-6">
        <div className="ios-card w-full max-w-sm p-5 space-y-4">
          <h2 className="ios-title text-xl">资料初始化失败</h2>
          <p className="text-sm text-gray-500">{startupError || '请稍后重试'}</p>
          <button type="button" className="ios-button-primary w-full py-3" onClick={() => setAccountRetrySeed(prev => prev + 1)}>
            重试
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="ios-page min-h-screen relative overflow-hidden">
      <div className="ios-floating-hearts" aria-hidden>
        <span>❤</span>
        <span>❤</span>
        <span>❤</span>
        <span>❤</span>
        <span>❤</span>
      </div>

      <div className="ios-app-frame ios-page flex min-h-screen flex-col overflow-hidden relative z-10">
        <main className="flex-1 min-h-0 overflow-hidden flex">
          <Suspense fallback={<div className="h-full flex items-center justify-center text-gray-500">加载中...</div>}>
            <div className="flex-1 min-h-0">
              <Routes>
                <Route
                  path="/"
                  element={
                    <ChatPage
                      currentSender={account.role}
                      currentUserLabel={account.username}
                      currentUserAvatar={account.avatarUrl}
                      avatarMap={avatarMap}
                    />
                  }
                />
                <Route path="/anniversary" element={<AnniversaryPage currentSender={account.role} />} />
                <Route path="/home" element={<HomePage currentSender={account.role} avatarMap={avatarMap} />} />
                <Route path="/moments" element={<Navigate to="/home" replace />} />
                <Route path="/photos" element={<PhotoWallPage currentSender={account.role} />} />
                <Route
                  path="/profile"
                  element={
                    <ProfilePage
                      account={account}
                      onProfileChange={profile => {
                        setAccount(profile)
                        setAvatarMap(prev => {
                          const next = { ...prev }
                          if (profile.avatarUrl) {
                            next[profile.role] = profile.avatarUrl
                          } else {
                            delete next[profile.role]
                          }
                          return next
                        })
                      }}
                      onSignOut={async () => {
                        await signOutPhoneAuth()
                        setPhoneAuthed(false)
                        setAccount(null)
                        setAvatarMap({})
                        setIsLocked(true)
                      }}
                    />
                  }
                />
                <Route path="/settings" element={<Navigate to="/profile" replace />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </div>
          </Suspense>
        </main>
        <TabBar />
      </div>
    </div>
  )
}

const App: React.FC = () => (
  <Router>
    <AppContent />
  </Router>
)

export default App
