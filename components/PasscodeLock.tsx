import React, { useEffect, useState } from 'react'
import { ArrowRight, Delete, Heart, Lock } from 'lucide-react'
import { STORAGE_KEYS } from '../constants'
import { storage } from '../services/storageService'

interface PasscodeLockProps {
  onSuccess: () => void
}

const MIN_PASSCODE_LENGTH = 4

const PasscodeLock: React.FC<PasscodeLockProps> = ({ onSuccess }) => {
  const [passcode, setPasscode] = useState('')
  const [savedPasscode, setSavedPasscode] = useState<string | null>(null)
  const [mode, setMode] = useState<'login' | 'setup'>('login')
  const [error, setError] = useState('')

  useEffect(() => {
    const stored = storage.get<string | null>(STORAGE_KEYS.PASSCODE, null)
    if (stored) {
      setSavedPasscode(stored)
      setMode('login')
    } else {
      setMode('setup')
    }
  }, [])

  const handleInput = (char: string) => {
    if (passcode.length >= 12) {
      return
    }

    setPasscode(prev => prev + char)
    if (error) {
      setError('')
    }
  }

  const handleBackspace = () => {
    setPasscode(prev => prev.slice(0, -1))
  }

  const handleSubmit = () => {
    if (mode === 'login') {
      if (passcode === savedPasscode) {
        onSuccess()
      } else {
        setError('密码错误，请重试')
        setPasscode('')
      }
      return
    }

    if (passcode.length < MIN_PASSCODE_LENGTH) {
      setError(`密码长度至少 ${MIN_PASSCODE_LENGTH} 位`)
      return
    }

    storage.set(STORAGE_KEYS.PASSCODE, passcode)
    onSuccess()
  }

  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'A', '0', 'B']

  return (
    <div
      className="fixed inset-0 z-[100] flex justify-center overflow-hidden"
      style={{
        background:
          'radial-gradient(circle at 14% 16%, rgba(255, 185, 200, 0.45) 0%, rgba(255, 185, 200, 0) 34%), radial-gradient(circle at 90% 4%, rgba(255, 227, 186, 0.48) 0%, rgba(255, 227, 186, 0) 30%), linear-gradient(180deg, #fff9fb 0%, #fff2f7 62%, #ffeef5 100%)',
        minHeight: '100dvh'
      }}
    >
      <div
        className="w-full h-full max-w-[460px] flex flex-col items-center text-center px-6"
        style={{
          paddingTop: 'calc(env(safe-area-inset-top) + 14px)',
          paddingBottom: 'calc(env(safe-area-inset-bottom) + 10px)'
        }}
      >
        <div className="w-full flex-1 min-h-0 flex flex-col items-center justify-center">
          <div className="mb-3 ios-feature-badge">
            <Heart size={12} /> 双人私密空间
          </div>

          <div className="mb-5 p-5 bg-rose-50 rounded-full shadow-sm">
            <Lock size={42} className="text-rose-500" />
          </div>

          <h1 className="text-2xl font-bold mb-2 text-rose-700">{mode === 'login' ? '输入访问密码' : '设置访问密码'}</h1>
          <p className="ios-soft-text mb-5">{mode === 'login' ? '只有你们可以进入这个空间' : '使用数字和字母组合，增强安全性'}</p>

          <div className="flex gap-3 justify-center mb-2 min-h-[32px]">
            {Array.from({ length: Math.max(passcode.length, MIN_PASSCODE_LENGTH) }).map((_, i) => (
              <div
                key={i}
                className={`w-4 h-4 rounded-full border-2 border-rose-500 transition-all ${
                  i < passcode.length ? 'bg-rose-500 scale-110' : 'bg-transparent'
                }`}
              />
            ))}
          </div>

          <div className="min-h-[24px]">
            {error && <p className="text-red-500 text-sm animate__animated animate__shakeX">{error}</p>}
          </div>
        </div>

        <div className="w-full max-w-xs mx-auto shrink-0">
          <div className="grid grid-cols-3 gap-4 w-full">
            {keys.map(key => (
              <button
                key={key}
                type="button"
                onClick={() => handleInput(key)}
                className="w-16 h-16 rounded-full ios-blur flex items-center justify-center text-2xl font-medium active:bg-rose-100 transition-colors"
              >
                {key}
              </button>
            ))}
            <div />
            <button
              type="button"
              onClick={handleBackspace}
              className="w-16 h-16 rounded-full flex items-center justify-center text-gray-500 active:text-black"
            >
              <Delete size={24} />
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              className="w-16 h-16 rounded-full bg-rose-500 text-white flex items-center justify-center active:bg-rose-600 shadow-lg"
            >
              <ArrowRight size={28} />
            </button>
          </div>
        </div>

        <div className="mt-3">
          <button
            type="button"
            className="text-rose-500 font-medium text-sm"
          >
            忘记密码？可在后续版本通过密保找回
          </button>
        </div>
      </div>
    </div>
  )
}

export default PasscodeLock
