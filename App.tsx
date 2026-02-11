import React, { Suspense, lazy, useEffect, useState } from 'react'
import { HashRouter as Router, Navigate, NavLink, Route, Routes } from 'react-router-dom'
import { CalendarClock, Camera, House, MessageCircle, UserCircle2 } from 'lucide-react'
import PasscodeLock from './components/PasscodeLock'
import AuthGateway from './components/AuthGateway'
import { AccountProfile, CoupleAvatarMap, ensureAccountProfile, getCoupleAvatarMap } from './services/accountService'
import { isPhoneAuthenticated, signOutPhoneAuth } from './services/authService'
import { getAppLockEnabled } from './services/securityService'

const ChatPage = lazy(() => import('./pages/ChatPage'))
const AnniversaryPage = lazy(() => import('./pages/AnniversaryPage'))
const HomePage = lazy(() => import('./pages/HomePage'))
const PhotoWallPage = lazy(() => import('./pages/PhotoWallPage'))
const ProfilePage = lazy(() => import('./pages/ProfilePage'))

const tabs = [
  { to: '/', label: '聊天', icon: MessageCircle },
  { to: '/anniversary', label: '纪念日', icon: CalendarClock },
  { to: '/home', label: '家园', icon: House },
  { to: '/photos', label: '照片墙', icon: Camera },
  { to: '/profile', label: '主页', icon: UserCircle2 }
]

const LoadingState: React.FC<{ label: string; fullscreen?: boolean }> = ({ label, fullscreen = true }) => (
  <div className={`ios-page ${fullscreen ? 'min-h-screen' : 'h-full min-h-0'} flex items-center justify-center px-5`}>
    <div className="ios-card w-full max-w-xs p-6 text-center">
      <div className="ios-spinner mx-auto" />
      <p className="text-sm text-gray-500 mt-3">{label}</p>
    </div>
  </div>
)

const TabBar: React.FC = () => (
  <nav className="ios-tabbar ios-blur ios-safe-bottom" aria-label="主导航">
    <div className="grid grid-cols-5 items-center gap-1 px-2 pt-2 pb-2">
      {tabs.map(tab => {
        const Icon = tab.icon
        return (
          <NavLink
            key={tab.to}
            to={tab.to}
            className={({ isActive }) =>
              `ios-tab-item flex flex-col items-center justify-center gap-1 transition-all ${isActive ? 'active text-rose-600' : 'text-gray-400'}`
            }
          >
            <Icon size={20} />
            <span className="text-[10px] font-semibold tracking-[0.02em]">{tab.label}</span>
          </NavLink>
        )
      })}
    </div>
  </nav>
)

const AppContent: React.FC = () => {
  const [authLoading, setAuthLoading] = useState(true)
  const [phoneAuthed, setPhoneAuthed] = useState(false)
  const [appLockEnabled, setAppLockEnabled] = useState(() => getAppLockEnabled())
  const [isLocked, setIsLocked] = useState(() => getAppLockEnabled())
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
    if (!phoneAuthed) {
      return
    }

    setIsLocked(appLockEnabled)
  }, [appLockEnabled, phoneAuthed])

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

    void bootstrap()

    return () => {
      active = false
    }
  }, [accountRetrySeed, isLocked, phoneAuthed])

  if (authLoading) {
    return <LoadingState label="登录状态检查中..." />
  }

  if (!phoneAuthed) {
    return <AuthGateway onAuthed={() => setPhoneAuthed(true)} />
  }

  if (appLockEnabled && isLocked) {
    return <PasscodeLock onSuccess={() => setIsLocked(false)} />
  }

  if (accountLoading) {
    return <LoadingState label="账号初始化中..." />
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
          <button
            type="button"
            className="ios-button-secondary w-full py-3"
            onClick={async () => {
              await signOutPhoneAuth()
              setPhoneAuthed(false)
              setAccount(null)
              setAvatarMap({})
              setIsLocked(getAppLockEnabled())
              setStartupError('')
            }}
          >
            退出当前账号
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
          <Suspense fallback={<LoadingState label="页面加载中..." fullscreen={false} />}>
            <div className="flex-1 min-h-0 ios-route-frame">
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
                      appLockEnabled={appLockEnabled}
                      onAppLockEnabledChange={enabled => {
                        setAppLockEnabled(enabled)
                        setIsLocked(enabled)
                      }}
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
                        setIsLocked(getAppLockEnabled())
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
