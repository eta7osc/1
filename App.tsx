import React, { Suspense, lazy, useState } from 'react'
import { HashRouter as Router, NavLink, Route, Routes } from 'react-router-dom'
import { Calendar, Camera, Heart, MessageCircle, Settings } from 'lucide-react'
import PasscodeLock from './components/PasscodeLock'

const ChatPage = lazy(() => import('./pages/ChatPage'))
const AnniversaryPage = lazy(() => import('./pages/AnniversaryPage'))
const MomentsPage = lazy(() => import('./pages/MomentsPage'))
const PhotoWallPage = lazy(() => import('./pages/PhotoWallPage'))

const SettingsPage: React.FC = () => (
  <div className="p-6 space-y-6 bg-[#F2F2F7] min-h-full">
    <h2 className="text-3xl font-bold">设置</h2>
    <div className="bg-white rounded-2xl overflow-hidden shadow-sm">
      <button type="button" className="w-full p-4 border-b flex items-center justify-between active:bg-gray-50">
        <span>修改访问密码</span>
        <Settings size={18} className="text-gray-300" />
      </button>
      <button type="button" className="w-full p-4 border-b flex items-center justify-between active:bg-gray-50">
        <span>通知设置</span>
        <Settings size={18} className="text-gray-300" />
      </button>
      <div className="p-4 flex items-center justify-between active:bg-gray-50">
        <span>隐私模式</span>
        <div className="w-12 h-6 bg-green-500 rounded-full relative p-1">
          <div className="w-4 h-4 bg-white rounded-full absolute right-1" />
        </div>
      </div>
    </div>

    <div className="bg-white rounded-2xl p-4 shadow-sm text-center">
      <p className="text-xs text-gray-400">Version 1.0.0</p>
      <p className="text-xs text-gray-400 mt-1">Made with love</p>
    </div>
  </div>
)

const TabBar: React.FC = () => (
  <nav className="fixed bottom-0 left-0 right-0 ios-blur border-t safe-pb z-50 flex justify-around items-center pt-2">
    <NavLink
      to="/"
      className={({ isActive }) => `flex flex-col items-center gap-1 py-1 transition-colors ${isActive ? 'text-pink-500' : 'text-gray-400'}`}
    >
      <MessageCircle size={24} />
      <span className="text-[10px] font-medium">聊天</span>
    </NavLink>
    <NavLink
      to="/anniversary"
      className={({ isActive }) => `flex flex-col items-center gap-1 py-1 transition-colors ${isActive ? 'text-pink-500' : 'text-gray-400'}`}
    >
      <Calendar size={24} />
      <span className="text-[10px] font-medium">纪念日</span>
    </NavLink>
    <NavLink
      to="/moments"
      className={({ isActive }) => `flex flex-col items-center gap-1 py-1 transition-colors ${isActive ? 'text-pink-500' : 'text-gray-400'}`}
    >
      <Heart size={24} />
      <span className="text-[10px] font-medium">朋友圈</span>
    </NavLink>
    <NavLink
      to="/photos"
      className={({ isActive }) => `flex flex-col items-center gap-1 py-1 transition-colors ${isActive ? 'text-pink-500' : 'text-gray-400'}`}
    >
      <Camera size={24} />
      <span className="text-[10px] font-medium">相册</span>
    </NavLink>
    <NavLink
      to="/settings"
      className={({ isActive }) => `flex flex-col items-center gap-1 py-1 transition-colors ${isActive ? 'text-pink-500' : 'text-gray-400'}`}
    >
      <Settings size={24} />
      <span className="text-[10px] font-medium">设置</span>
    </NavLink>
  </nav>
)

const AppContent: React.FC = () => {
  const [isLocked, setIsLocked] = useState(true)

  if (isLocked) {
    return <PasscodeLock onSuccess={() => setIsLocked(false)} />
  }

  return (
    <div className="h-screen flex flex-col relative overflow-hidden">
      <main className="flex-1 overflow-hidden">
        <Suspense fallback={<div className="h-full flex items-center justify-center text-gray-500">加载中...</div>}>
          <Routes>
            <Route path="/" element={<ChatPage />} />
            <Route path="/anniversary" element={<AnniversaryPage />} />
            <Route path="/moments" element={<MomentsPage />} />
            <Route path="/photos" element={<PhotoWallPage />} />
            <Route path="/settings" element={<SettingsPage />} />
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
