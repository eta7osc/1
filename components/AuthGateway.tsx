import React, { useMemo, useState } from 'react'
import { KeyRound, LogIn, MessageSquareText, ShieldCheck, Smartphone } from 'lucide-react'
import { loginBySmsOrPassword, registerBySms, sendPhoneSmsCode } from '../services/authService'

type AuthMode = 'login' | 'register'

interface AuthGatewayProps {
  onAuthed: () => void
}

const COUNTDOWN_SECONDS = 60

const AuthGateway: React.FC<AuthGatewayProps> = ({ onAuthed }) => {
  const [mode, setMode] = useState<AuthMode>('login')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [phoneCode, setPhoneCode] = useState('')
  const [password, setPassword] = useState('')
  const [countdown, setCountdown] = useState(0)
  const [sendingCode, setSendingCode] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [hint, setHint] = useState('')

  const canSendCode = countdown <= 0 && !sendingCode
  const submitText = useMemo(() => {
    if (submitting) {
      return mode === 'login' ? '登录中...' : '注册中...'
    }
    return mode === 'login' ? '立即登录' : '注册并登录'
  }, [mode, submitting])

  const startCountdown = () => {
    setCountdown(COUNTDOWN_SECONDS)
    const timer = window.setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer)
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }

  const handleSendCode = async () => {
    if (!canSendCode) {
      return
    }

    try {
      setSendingCode(true)
      setError('')
      setHint('')
      const normalizedPhone = await sendPhoneSmsCode(phoneNumber)
      setHint(`验证码已发送到 ${normalizedPhone}`)
      startCountdown()
    } catch (err) {
      setError(err instanceof Error ? err.message : '验证码发送失败，请稍后重试')
    } finally {
      setSendingCode(false)
    }
  }

  const handleSubmit = async () => {
    try {
      setSubmitting(true)
      setError('')
      setHint('')

      if (mode === 'login') {
        await loginBySmsOrPassword({ phoneNumber, phoneCode, password })
      } else {
        await registerBySms(phoneNumber, phoneCode, password)
      }

      onAuthed()
    } catch (err) {
      setError(err instanceof Error ? err.message : mode === 'login' ? '登录失败，请稍后重试' : '注册失败，请稍后重试')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="ios-page min-h-screen p-6 auth-scene flex items-center justify-center">
      <div className="auth-grid w-full max-w-4xl">
        <section className="auth-hero ios-card p-7 md:p-9">
          <span className="ios-feature-badge">Lover Security</span>
          <h1 className="ios-title text-3xl mt-4">短信验证码登录</h1>
          <p className="ios-soft-text text-sm mt-2 leading-6">先完成手机号验证，再进入你们的双人私密空间，防止陌生人误入。</p>
          <div className="auth-feature-list mt-6">
            <div className="auth-feature-item">
              <ShieldCheck size={18} />
              <span>账号身份可信，设备可追踪</span>
            </div>
            <div className="auth-feature-item">
              <MessageSquareText size={18} />
              <span>短信校验，支持密码兜底登录</span>
            </div>
            <div className="auth-feature-item">
              <KeyRound size={18} />
              <span>登录后再进入应用内手势锁</span>
            </div>
          </div>
        </section>

        <section className="ios-card p-6 md:p-8 auth-panel">
          <div className="ios-segment w-full">
            <button type="button" className={mode === 'login' ? 'is-active flex-1' : 'flex-1'} onClick={() => setMode('login')}>
              登录
            </button>
            <button type="button" className={mode === 'register' ? 'is-active flex-1' : 'flex-1'} onClick={() => setMode('register')}>
              注册
            </button>
          </div>

          <div className="mt-5 space-y-3">
            <label className="text-xs text-gray-500">手机号</label>
            <div className="auth-input-wrap">
              <Smartphone size={16} />
              <input
                className="ios-input px-3 py-2.5"
                placeholder="请输入手机号（支持 +86）"
                value={phoneNumber}
                onChange={e => setPhoneNumber(e.target.value)}
              />
            </div>
          </div>

          <div className="mt-4 space-y-3">
            <label className="text-xs text-gray-500">短信验证码</label>
            <div className="flex items-center gap-2">
              <input
                className="ios-input px-3 py-2.5"
                placeholder="4-8 位验证码"
                value={phoneCode}
                onChange={e => setPhoneCode(e.target.value)}
              />
              <button type="button" onClick={handleSendCode} disabled={!canSendCode} className="ios-button-secondary px-3 py-2 text-sm whitespace-nowrap disabled:opacity-60">
                {sendingCode ? '发送中...' : countdown > 0 ? `${countdown}s` : '获取验证码'}
              </button>
            </div>
          </div>

          <div className="mt-4 space-y-3">
            <label className="text-xs text-gray-500">{mode === 'login' ? '密码（可选）' : '密码（必填）'}</label>
            <div className="auth-input-wrap">
              <KeyRound size={16} />
              <input
                className="ios-input px-3 py-2.5"
                placeholder={mode === 'login' ? '填密码可不输验证码' : '8-32 位，包含字母和数字'}
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
              />
            </div>
          </div>

          {hint && <p className="mt-4 text-sm text-emerald-600">{hint}</p>}
          {error && <p className="mt-4 text-sm text-rose-500">{error}</p>}

          <button type="button" onClick={handleSubmit} disabled={submitting} className="ios-button-primary w-full py-3 mt-5 disabled:opacity-60">
            <span className="inline-flex items-center gap-2">
              <LogIn size={16} />
              {submitText}
            </span>
          </button>

          <p className="text-xs ios-soft-text mt-4 leading-5">
            {mode === 'login'
              ? '登录支持：手机号+验证码 或 手机号+密码。'
              : '注册流程：先获取验证码，再设置密码完成账号创建。'}
          </p>
        </section>
      </div>
    </div>
  )
}

export default AuthGateway
