import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Camera, ImagePlus, LogOut, Save, UserCircle2 } from 'lucide-react'
import { AccountProfile, updateAccountAvatar, updateAccountCover, updateAccountUsername } from '../services/accountService'

interface ProfilePageProps {
  account: AccountProfile
  onProfileChange: (profile: AccountProfile) => void
  onSignOut: () => Promise<void>
}

const ProfilePage: React.FC<ProfilePageProps> = ({ account, onProfileChange, onSignOut }) => {
  const [username, setUsername] = useState(account.username)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [uploadingCover, setUploadingCover] = useState(false)
  const [savingName, setSavingName] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const [error, setError] = useState('')
  const [hint, setHint] = useState('')

  const avatarInputRef = useRef<HTMLInputElement | null>(null)
  const coverInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    setUsername(account.username)
  }, [account.username])

  const shortUid = useMemo(() => {
    if (!account.uid) {
      return '--'
    }

    if (account.uid.length <= 12) {
      return account.uid
    }

    return `${account.uid.slice(0, 6)}...${account.uid.slice(-4)}`
  }, [account.uid])

  const handleAvatarInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''

    if (!file || uploadingAvatar) {
      return
    }

    try {
      setUploadingAvatar(true)
      setError('')
      setHint('')
      const profile = await updateAccountAvatar(file)
      onProfileChange(profile)
      setHint('头像已更新')
    } catch (err) {
      setError(err instanceof Error ? err.message : '头像更新失败，请稍后重试')
    } finally {
      setUploadingAvatar(false)
    }
  }

  const handleCoverInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''

    if (!file || uploadingCover) {
      return
    }

    try {
      setUploadingCover(true)
      setError('')
      setHint('')
      const profile = await updateAccountCover(file)
      onProfileChange(profile)
      setHint('主页背景已更新')
    } catch (err) {
      setError(err instanceof Error ? err.message : '背景图更新失败，请稍后重试')
    } finally {
      setUploadingCover(false)
    }
  }

  const handleSaveUsername = async () => {
    const trimmed = username.trim()
    if (!trimmed) {
      setError('用户名不能为空')
      return
    }

    if (trimmed === account.username) {
      setHint('用户名未变化')
      setError('')
      return
    }

    try {
      setSavingName(true)
      setError('')
      setHint('')
      const profile = await updateAccountUsername(trimmed)
      onProfileChange(profile)
      setHint('用户名已保存')
    } catch (err) {
      setError(err instanceof Error ? err.message : '用户名更新失败，请稍后重试')
    } finally {
      setSavingName(false)
    }
  }

  const handleSignOut = async () => {
    try {
      setSigningOut(true)
      setError('')
      await onSignOut()
    } catch (err) {
      setError(err instanceof Error ? err.message : '退出登录失败，请稍后重试')
      setSigningOut(false)
    }
  }

  return (
    <div className="ios-page ios-scroll ios-safe-top page-stack profile-page space-y-3">
      <section className="ios-card profile-hero overflow-hidden">
        <div className="profile-cover">
          {account.coverUrl ? (
            <img src={account.coverUrl} alt="profile-cover" className="profile-cover-image" />
          ) : (
            <div className="profile-cover-fallback" aria-hidden />
          )}
          <div className="profile-cover-mask" aria-hidden />
          <button
            type="button"
            className="profile-cover-action"
            disabled={uploadingCover}
            onClick={() => coverInputRef.current?.click()}
          >
            <ImagePlus size={15} /> {uploadingCover ? '上传中...' : '更换背景'}
          </button>
        </div>

        <div className="profile-summary">
          <div className="profile-avatar-wrap">
            <div className="profile-avatar">
              {account.avatarUrl ? <img src={account.avatarUrl} alt="profile-avatar" className="h-full w-full object-cover" /> : <UserCircle2 size={52} />}
            </div>
            <button
              type="button"
              className="profile-avatar-action"
              disabled={uploadingAvatar}
              onClick={() => avatarInputRef.current?.click()}
            >
              <Camera size={13} /> {uploadingAvatar ? '上传中' : '头像'}
            </button>
          </div>

          <div className="min-w-0">
            <h2 className="ios-title text-2xl truncate">{account.username}</h2>
            <p className="text-xs text-gray-500 mt-1">UID: {shortUid}</p>
            <div className="mt-2 inline-flex items-center gap-2 text-[11px] text-rose-500 font-semibold bg-rose-50 rounded-full px-3 py-1">
              社交主页
            </div>
          </div>
        </div>
      </section>

      <section className="ios-card p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-gray-700">用户名</h3>
          <span className="text-xs text-gray-500">最多 20 个字符</span>
        </div>
        <div className="flex items-center gap-2">
          <input
            value={username}
            onChange={e => setUsername(e.target.value)}
            className="ios-input px-3 py-2"
            placeholder="请输入用户名"
            maxLength={20}
          />
          <button type="button" onClick={handleSaveUsername} disabled={savingName} className="ios-button-primary px-3 py-2 text-sm shrink-0 disabled:opacity-60">
            <span className="inline-flex items-center gap-1">
              <Save size={14} /> {savingName ? '保存中' : '保存'}
            </span>
          </button>
        </div>
      </section>

      <section className="ios-card p-4 space-y-3">
        <h3 className="text-sm font-semibold text-gray-700">主页资料</h3>
        <div className="grid grid-cols-3 gap-2">
          <div className="profile-stat-card">
            <p className="profile-stat-label">头像</p>
            <p className="profile-stat-value">{account.avatarUrl ? '已设置' : '未设置'}</p>
          </div>
          <div className="profile-stat-card">
            <p className="profile-stat-label">背景</p>
            <p className="profile-stat-value">{account.coverUrl ? '已设置' : '未设置'}</p>
          </div>
          <div className="profile-stat-card">
            <p className="profile-stat-label">身份</p>
            <p className="profile-stat-value">{account.role === 'me' ? '我' : '她'}</p>
          </div>
        </div>
      </section>

      <section className="ios-card p-4 space-y-3">
        <h3 className="text-sm font-semibold text-gray-700">账号安全</h3>
        <button type="button" onClick={handleSignOut} disabled={signingOut} className="ios-button-secondary w-full py-3 text-sm disabled:opacity-60">
          <span className="inline-flex items-center gap-1">
            <LogOut size={14} /> {signingOut ? '退出中...' : '退出登录'}
          </span>
        </button>
      </section>

      {hint && <div className="text-center text-sm text-emerald-600">{hint}</div>}
      {error && <div className="text-center text-sm text-rose-500">{error}</div>}

      <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarInput} />
      <input ref={coverInputRef} type="file" accept="image/*" className="hidden" onChange={handleCoverInput} />
    </div>
  )
}

export default ProfilePage
