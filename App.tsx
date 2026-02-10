import React, { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react'
import { HashRouter as Router, Navigate, NavLink, Route, Routes } from 'react-router-dom'
import { CalendarClock, Camera, House, MessageCircle, Settings, ShieldCheck, UserCircle2 } from 'lucide-react'
import PasscodeLock from './components/PasscodeLock'
import { AccountProfile, bindAccount, getBoundAccount, unbindCurrentAccount, updateAccountAvatar } from './services/accountService'
import type { Sender } from './services/chatService'

const ChatPage = lazy(() => import('./pages/ChatPage'))
const AnniversaryPage = lazy(() => import('./pages/AnniversaryPage'))
const HomePage = lazy(() => import('./pages/HomePage'))
const PhotoWallPage = lazy(() => import('./pages/PhotoWallPage'))

const AccountBindPage: React.FC<{ onBound: (profile: AccountProfile) => void; startupError?: string }> = ({
  onBound,
  startupError
}) => {
  const [role, setRole] = useState<Sender>('me')
  const [inviteCode, setInviteCode] = useState('')
  const [binding, setBinding] = useState(false)
  const [error, setError] = useState('')

  const handleBind = async () => {
    if (!inviteCode.trim()) {
      setError('请输入邀请码')
      return
    }

    try {
      setBinding(true)
      setError('')
      const profile = await bindAccount(role, inviteCode)
      onBound(profile)
    } catch (err) {
      setError(err instanceof Error ? err.message : '绑定失败，请稍后重试')
    } finally {
      setBinding(false)
    }
  }

  return (
    <div className="ios-page flex min-h-screen items-center justify-center p-6">
      <div className="ios-card w-full max-w-sm p-6 space-y-5 relative z-10">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-2xl bg-rose-100 text-rose-500 flex items-center justify-center">
            <ShieldCheck size={22} />
          </div>
          <div>
            <h2 className="ios-title text-2xl">绑定情侣账号</h2>
            <p className="text-xs ios-soft-text">仅允许你们两位使用，绑定后自动互联同步</p>
          </div>
        </div>

        {startupError && <div className="text-sm text-red-500">{startupError}</div>}

        <div className="ios-segment w-full">
          <button type="button" onClick={() => setRole('me')} className={role === 'me' ? 'is-active flex-1' : 'flex-1'}>
            我
          </button>
          <button type="button" onClick={() => setRole('her')} className={role === 'her' ? 'is-active flex-1' : 'flex-1'}>
            她
          </button>
        </div>

        <div className="space-y-2">
          <label className="text-xs text-gray-500">请输入{role === 'me' ? '我方' : '她方'}邀请码</label>
          <input
            className="ios-input px-3 py-2.5"
            value={inviteCode}
            onChange={e => setInviteCode(e.target.value)}
            placeholder="邀请码"
          />
        </div>

        {error && <div className="text-sm text-red-500">{error}</div>}

        <button type="button" onClick={handleBind} disabled={binding} className="ios-button-primary w-full py-3 disabled:opacity-60">
          {binding ? '绑定中...' : '确认绑定'}
        </button>
      </div>
    </div>
  )
}

interface SettingsPageProps {
  account: AccountProfile
  onRebind: () => Promise<void>
  onProfileChange: (profile: AccountProfile) => void
}

const SettingsPage: React.FC<SettingsPageProps> = ({ account, onRebind, onProfileChange }) => {
  const [rebinding, setRebinding] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [error, setError] = useState('')
  const avatarInputRef = useRef<HTMLInputElement | null>(null)

  const handleRebind = async () => {
    try {
      setRebinding(true)
      setError('')
      await onRebind()
    } catch (err) {
      setError(err instanceof Error ? err.message : '解绑失败，请稍后重试')
      setRebinding(false)
    }
  }

  const handleAvatarInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''

    if (!file || uploadingAvatar) {
      return
    }

    try {
      setUploadingAvatar(true)
      setError('')
      const profile = await updateAccountAvatar(file)
      onProfileChange(profile)
    } catch (err) {
      setError(err instanceof Error ? err.message : '头像更新失败，请稍后重试')
    } finally {
      setUploadingAvatar(false)
    }
  }

  return (
    <div className="ios-page px-4 pb-32 ios-safe-top ios-scroll">
      <div className="ios-card p-5 space-y-5">
        <div>
          <h2 className="ios-title text-2xl">设置</h2>
          <p className="text-sm ios-soft-text mt-1">管理身份、安全和双人空间</p>
        </div>

        <div className="ios-card-flat p-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-14 w-14 rounded-full overflow-hidden bg-rose-100 text-rose-400 flex items-center justify-center">
              {account.avatarUrl ? (
                <img src={account.avatarUrl} alt="avatar" className="h-full w-full object-cover" />
              ) : (
                <UserCircle2 size={40} />
              )}
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-700">我的头像</p>
              <p className="text-xs text-gray-500">支持 jpg/png/webp，大小不超过 5MB</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => avatarInputRef.current?.click()}
            disabled={uploadingAvatar}
            className="ios-button-secondary px-3 py-2 text-sm disabled:opacity-60"
          >
            {uploadingAvatar ? '上传中...' : '更换头像'}
          </button>
        </div>

        <div className="ios-card-flat overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <span>当前账号</span>
            <span className="ios-chip ios-chip-info">{account.nickname}</span>
          </div>
          <div className="px-4 py-3 border-b border-gray-100/80 flex items-center justify-between">
            <span>双人绑定状态</span>
            <span className="text-green-600 text-sm font-semibold">正常</span>
          </div>
          <button
            type="button"
            className="w-full px-4 py-3 text-left flex items-center justify-between disabled:opacity-60"
            onClick={handleRebind}
            disabled={rebinding}
          >
            <span>切换/重绑账号</span>
            <span className="text-rose-500 text-sm font-semibold">{rebinding ? '解绑中...' : '重新绑定'}</span>
          </button>
        </div>

        {error && <div className="text-sm text-red-500">{error}</div>}
      </div>

      <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarInput} />
    </div>
  )
}

const TabBar: React.FC = () => (
  <nav className="ios-tabbar ios-blur ios-safe-bottom">
    <div className="flex justify-around items-center pt-2 pb-2">
      <NavLink
        to="/"
        className={({ isActive }) => `flex flex-col items-center gap-1 py-1 transition-colors ${isActive ? 'text-rose-500' : 'text-gray-400'}`}
      >
        <MessageCircle size={22} />
        <span className="text-[10px] font-semibold">聊天</span>
      </NavLink>
      <NavLink
        to="/anniversary"
        className={({ isActive }) => `flex flex-col items-center gap-1 py-1 transition-colors ${isActive ? 'text-rose-500' : 'text-gray-400'}`}
      >
        <CalendarClock size={22} />
        <span className="text-[10px] font-semibold">纪念日</span>
      </NavLink>
      <NavLink
        to="/home"
        className={({ isActive }) => `flex flex-col items-center gap-1 py-1 transition-colors ${isActive ? 'text-rose-500' : 'text-gray-400'}`}
      >
        <House size={22} />
        <span className="text-[10px] font-semibold">家园</span>
      </NavLink>
      <NavLink
        to="/photos"
        className={({ isActive }) => `flex flex-col items-center gap-1 py-1 transition-colors ${isActive ? 'text-rose-500' : 'text-gray-400'}`}
      >
        <Camera size={22} />
        <span className="text-[10px] font-semibold">照片墙</span>
      </NavLink>
      <NavLink
        to="/settings"
        className={({ isActive }) => `flex flex-col items-center gap-1 py-1 transition-colors ${isActive ? 'text-rose-500' : 'text-gray-400'}`}
      >
        <Settings size={22} />
        <span className="text-[10px] font-semibold">设置</span>
      </NavLink>
    </div>
  </nav>
)

const AppContent: React.FC = () => {
  const [isLocked, setIsLocked] = useState(true)
  const [accountLoading, setAccountLoading] = useState(false)
  const [account, setAccount] = useState<AccountProfile | null>(null)
  const [startupError, setStartupError] = useState('')

  useEffect(() => {
    if (isLocked) {
      return
    }

    let active = true
    setAccountLoading(true)
    setStartupError('')

    getBoundAccount()
      .then(profile => {
        if (active) {
          setAccount(profile)
        }
      })
      .catch(err => {
        if (active) {
          setStartupError(err instanceof Error ? err.message : '初始化失败')
          setAccount(null)
        }
      })
      .finally(() => {
        if (active) {
          setAccountLoading(false)
        }
      })

    return () => {
      active = false
    }
  }, [isLocked])

  const settingsPage = useMemo(() => {
    if (!account) {
      return <div className="px-6 pt-10">未绑定账号</div>
    }

    return (
      <SettingsPage
        account={account}
        onProfileChange={setAccount}
        onRebind={async () => {
          await unbindCurrentAccount()
          setAccount(null)
        }}
      />
    )
  }, [account])

  if (isLocked) {
    return <PasscodeLock onSuccess={() => setIsLocked(false)} />
  }

  if (accountLoading) {
    return <div className="ios-page min-h-screen flex items-center justify-center text-gray-500">账号初始化中...</div>
  }

  if (!account) {
    return <AccountBindPage onBound={setAccount} startupError={startupError} />
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
                    <ChatPage currentSender={account.role} currentUserLabel={account.nickname} currentUserAvatar={account.avatarUrl} />
                  }
                />
                <Route path="/anniversary" element={<AnniversaryPage currentSender={account.role} />} />
                <Route path="/home" element={<HomePage currentSender={account.role} />} />
                <Route path="/moments" element={<Navigate to="/home" replace />} />
                <Route path="/photos" element={<PhotoWallPage currentSender={account.role} />} />
                <Route path="/settings" element={settingsPage} />
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
