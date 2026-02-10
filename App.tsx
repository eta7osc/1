import React, { Suspense, lazy, useEffect, useMemo, useState } from 'react'
import { HashRouter as Router, Navigate, NavLink, Route, Routes } from 'react-router-dom'
import { CalendarClock, Camera, House, MessageCircle, Settings, ShieldCheck } from 'lucide-react'
import PasscodeLock from './components/PasscodeLock'
import { AccountProfile, bindAccount, clearCachedProfile, getBoundAccount } from './services/accountService'
import type { Sender } from './services/chatService'

const ChatPage = lazy(() => import('./pages/ChatPage'))
const AnniversaryPage = lazy(() => import('./pages/AnniversaryPage'))
const HomePage = lazy(() => import('./pages/HomePage'))
const PhotoWallPage = lazy(() => import('./pages/PhotoWallPage'))

const AccountBindPage: React.FC<{ onBound: (profile: AccountProfile) => void }> = ({ onBound }) => {
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
      <div className="ios-card w-full max-w-sm p-6 space-y-5">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-2xl bg-blue-100 text-blue-500 flex items-center justify-center">
            <ShieldCheck size={22} />
          </div>
          <div>
            <h2 className="ios-title text-2xl">绑定情侣账号</h2>
            <p className="text-xs text-gray-500">仅允许两位使用，身份绑定后自动同步</p>
          </div>
        </div>

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

const SettingsPage: React.FC<{ account: AccountProfile; onRebind: () => void }> = ({ account, onRebind }) => (
  <div className="ios-page px-4 pb-32 ios-safe-top ios-scroll">
    <div className="ios-card p-5 space-y-5">
      <div>
        <h2 className="ios-title text-2xl">设置</h2>
        <p className="text-sm text-gray-500 mt-1">管理账号和安全选项</p>
      </div>

      <div className="ios-card-flat overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <span>当前账号</span>
          <span className="ios-chip ios-chip-info">{account.nickname}</span>
        </div>
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <span>双人绑定状态</span>
          <span className="text-green-600 text-sm font-semibold">正常</span>
        </div>
        <button type="button" className="w-full px-4 py-3 text-left flex items-center justify-between" onClick={onRebind}>
          <span>切换/重绑账号</span>
          <span className="text-blue-500 text-sm font-semibold">重新绑定</span>
        </button>
      </div>
    </div>
  </div>
)

const TabBar: React.FC = () => (
  <nav className="ios-tabbar ios-blur ios-safe-bottom">
    <div className="flex justify-around items-center pt-2 pb-2">
      <NavLink
        to="/"
        className={({ isActive }) => `flex flex-col items-center gap-1 py-1 transition-colors ${isActive ? 'text-blue-500' : 'text-gray-400'}`}
      >
        <MessageCircle size={22} />
        <span className="text-[10px] font-semibold">聊天</span>
      </NavLink>
      <NavLink
        to="/anniversary"
        className={({ isActive }) => `flex flex-col items-center gap-1 py-1 transition-colors ${isActive ? 'text-blue-500' : 'text-gray-400'}`}
      >
        <CalendarClock size={22} />
        <span className="text-[10px] font-semibold">纪念日</span>
      </NavLink>
      <NavLink
        to="/home"
        className={({ isActive }) => `flex flex-col items-center gap-1 py-1 transition-colors ${isActive ? 'text-blue-500' : 'text-gray-400'}`}
      >
        <House size={22} />
        <span className="text-[10px] font-semibold">家</span>
      </NavLink>
      <NavLink
        to="/photos"
        className={({ isActive }) => `flex flex-col items-center gap-1 py-1 transition-colors ${isActive ? 'text-blue-500' : 'text-gray-400'}`}
      >
        <Camera size={22} />
        <span className="text-[10px] font-semibold">照片墙</span>
      </NavLink>
      <NavLink
        to="/settings"
        className={({ isActive }) => `flex flex-col items-center gap-1 py-1 transition-colors ${isActive ? 'text-blue-500' : 'text-gray-400'}`}
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

  useEffect(() => {
    if (isLocked) {
      return
    }

    let active = true
    setAccountLoading(true)

    getBoundAccount()
      .then(profile => {
        if (active) {
          setAccount(profile)
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
        onRebind={() => {
          clearCachedProfile()
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
    return <AccountBindPage onBound={setAccount} />
  }

  return (
    <div className="ios-app-frame ios-page flex min-h-screen flex-col overflow-hidden">
      <main className="flex-1 overflow-hidden pb-24">
        <Suspense fallback={<div className="h-full flex items-center justify-center text-gray-500">加载中...</div>}>
          <Routes>
            <Route path="/" element={<ChatPage currentSender={account.role} currentUserLabel={account.nickname} />} />
            <Route path="/anniversary" element={<AnniversaryPage currentSender={account.role} />} />
            <Route path="/home" element={<HomePage currentSender={account.role} />} />
            <Route path="/moments" element={<Navigate to="/home" replace />} />
            <Route path="/photos" element={<PhotoWallPage currentSender={account.role} />} />
            <Route path="/settings" element={settingsPage} />
          </Routes>
        </Suspense>
      </main>
      <TabBar />
    </div>
  )
}

const App: React.FC = () => (
  <Router>
    <AppContent />
  </Router>
)

export default App
