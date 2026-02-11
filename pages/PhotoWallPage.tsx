import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Eye, Heart, ImagePlus, Lock, Video } from 'lucide-react'
import type { Sender } from '../services/chatService'
import { createWallItem, fetchWallItems, WallItem } from '../services/photoWallService'
import {
  getPrivateWallPasscode,
  MIN_SECURITY_PASSCODE_LENGTH,
  setPrivateWallPasscode,
  verifyPrivateWallPasscode
} from '../services/securityService'

interface PhotoWallPageProps {
  currentSender: Sender
}

type WallTab = 'public' | 'private'

const POLL_INTERVAL_MS = 7000

const PhotoWallPage: React.FC<PhotoWallPageProps> = ({ currentSender }) => {
  const [tab, setTab] = useState<WallTab>('public')
  const [publicItems, setPublicItems] = useState<WallItem[]>([])
  const [privateItems, setPrivateItems] = useState<WallItem[]>([])
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [savingPrivatePassword, setSavingPrivatePassword] = useState(false)
  const [error, setError] = useState('')
  const [hint, setHint] = useState('')
  const [privateUnlocked, setPrivateUnlocked] = useState(false)
  const [unlockPassword, setUnlockPassword] = useState('')
  const [privatePassword, setPrivatePassword] = useState(() => getPrivateWallPasscode())
  const [currentPrivatePassword, setCurrentPrivatePassword] = useState('')
  const [newPrivatePassword, setNewPrivatePassword] = useState('')
  const [confirmPrivatePassword, setConfirmPrivatePassword] = useState('')
  const [caption, setCaption] = useState('')
  const [showUploadSheet, setShowUploadSheet] = useState(false)

  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const loadPublic = useCallback(async () => {
    const data = await fetchWallItems(false)
    setPublicItems(data)
  }, [])

  const loadPrivate = useCallback(async () => {
    const data = await fetchWallItems(true)
    setPrivateItems(data)
  }, [])

  const loadAll = useCallback(
    async (withLoading = false) => {
      try {
        if (withLoading) {
          setLoading(true)
        }
        await loadPublic()
        if (privateUnlocked) {
          await loadPrivate()
        }
        setError('')
      } catch (err) {
        console.error('[PhotoWall] load failed', err)
        setError('照片墙加载失败，请检查网络或云开发配置')
      } finally {
        if (withLoading) {
          setLoading(false)
        }
      }
    },
    [loadPrivate, loadPublic, privateUnlocked]
  )

  useEffect(() => {
    loadAll(true)
  }, [loadAll])

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        loadAll(false)
      }
    }, POLL_INTERVAL_MS)

    return () => window.clearInterval(timer)
  }, [loadAll])

  const handleUnlockPrivate = async () => {
    if (!privatePassword) {
      setError('请先设置私密墙密码')
      return
    }

    if (!verifyPrivateWallPasscode(unlockPassword)) {
      setError('密码错误')
      return
    }

    setPrivateUnlocked(true)
    setError('')
    setHint('私密墙已解锁')
    setUnlockPassword('')

    try {
      await loadPrivate()
    } catch {
      setError('私密照片墙加载失败')
    }
  }

  const handleSavePrivatePassword = () => {
    try {
      setSavingPrivatePassword(true)
      setError('')
      setHint('')

      const existingPassword = getPrivateWallPasscode()
      const hasExistingPassword = Boolean(existingPassword)
      const trimmedCurrent = currentPrivatePassword.trim()
      const trimmedNew = newPrivatePassword.trim()
      const trimmedConfirm = confirmPrivatePassword.trim()

      if (trimmedNew.length < MIN_SECURITY_PASSCODE_LENGTH) {
        setError(`私密墙密码至少 ${MIN_SECURITY_PASSCODE_LENGTH} 位`)
        return
      }

      if (trimmedNew !== trimmedConfirm) {
        setError('两次输入的私密墙密码不一致')
        return
      }

      if (hasExistingPassword && trimmedCurrent !== existingPassword) {
        setError('当前私密墙密码不正确')
        return
      }

      setPrivateWallPasscode(trimmedNew)
      setPrivatePassword(trimmedNew)
      setPrivateUnlocked(true)
      setUnlockPassword('')
      setCurrentPrivatePassword('')
      setNewPrivatePassword('')
      setConfirmPrivatePassword('')
      setHint(hasExistingPassword ? '私密墙密码已更新' : '私密墙密码已设置')
    } finally {
      setSavingPrivatePassword(false)
    }
  }

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) {
      return
    }

    const isPrivate = tab === 'private'
    if (isPrivate && !privateUnlocked) {
      setError('请先解锁私密照片墙')
      return
    }

    try {
      setUploading(true)
      setError('')
      await createWallItem(currentSender, file, isPrivate, caption)
      setCaption('')
      setShowUploadSheet(false)
      await loadAll(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : '上传失败')
    } finally {
      setUploading(false)
    }
  }

  const currentItems = tab === 'private' ? privateItems : publicItems

  return (
    <div className="ios-page ios-scroll ios-safe-top page-stack space-y-3">
      <div className="ios-card p-4 space-y-3 bg-[linear-gradient(135deg,rgba(255,255,255,0.96),rgba(255,237,244,0.9))]">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="ios-title text-2xl">照片墙</h2>
            <p className="text-sm ios-soft-text mt-1">公开与私密回忆分区管理</p>
            <div className="mt-2 ios-feature-badge">
              <Heart size={11} /> 回忆收藏馆
            </div>
          </div>
          <button type="button" className="ios-button-primary h-10 w-10 flex items-center justify-center" onClick={() => setShowUploadSheet(true)}>
            <ImagePlus size={18} />
          </button>
        </div>

        <div className="ios-segment w-full sm:w-auto">
          <button type="button" className={tab === 'public' ? 'is-active' : ''} onClick={() => setTab('public')}>
            公共墙
          </button>
          <button type="button" className={tab === 'private' ? 'is-active' : ''} onClick={() => setTab('private')}>
            私密墙
          </button>
        </div>
      </div>

      {loading && <div className="text-center text-sm text-gray-400">加载中...</div>}
      {error && <div className="text-center text-sm text-red-500">{error}</div>}
      {hint && <div className="text-center text-sm text-emerald-600">{hint}</div>}

      {tab === 'private' && (
        <div className="ios-card p-5 space-y-4">
          {!privateUnlocked && (
            <>
              <div className="flex items-center gap-2 text-gray-700">
                <Lock size={18} />
                <h3 className="font-semibold">输入密码进入私密照片墙</h3>
              </div>
              <input
                className="ios-input px-3 py-2"
                type="password"
                placeholder={privatePassword ? '私密照片墙密码' : '请先设置私密墙密码'}
                value={unlockPassword}
                onChange={e => setUnlockPassword(e.target.value)}
              />
              <button type="button" className="ios-button-primary w-full py-3" onClick={handleUnlockPrivate} disabled={!privatePassword}>
                解锁私密墙
              </button>
            </>
          )}

          <div className="rounded-2xl border border-rose-100 bg-rose-50/70 p-3 space-y-3">
            <h4 className="text-sm font-semibold text-gray-700">私密墙密码设置</h4>
            {privatePassword ? (
              <input
                className="ios-input px-3 py-2 text-sm"
                type="password"
                placeholder="当前私密墙密码"
                value={currentPrivatePassword}
                onChange={e => setCurrentPrivatePassword(e.target.value)}
                disabled={savingPrivatePassword}
              />
            ) : (
              <div className="text-xs text-amber-600 bg-amber-50 rounded-xl px-3 py-2">当前未设置私密墙密码，请先设置。</div>
            )}
            <input
              className="ios-input px-3 py-2 text-sm"
              type="password"
              placeholder={`新密码（至少 ${MIN_SECURITY_PASSCODE_LENGTH} 位）`}
              value={newPrivatePassword}
              onChange={e => setNewPrivatePassword(e.target.value)}
              disabled={savingPrivatePassword}
            />
            <input
              className="ios-input px-3 py-2 text-sm"
              type="password"
              placeholder="确认新密码"
              value={confirmPrivatePassword}
              onChange={e => setConfirmPrivatePassword(e.target.value)}
              disabled={savingPrivatePassword}
            />
            <button
              type="button"
              className="ios-button-primary w-full py-2.5 text-sm disabled:opacity-60"
              onClick={handleSavePrivatePassword}
              disabled={savingPrivatePassword}
            >
              {savingPrivatePassword ? '保存中...' : privatePassword ? '修改私密墙密码' : '设置私密墙密码'}
            </button>
          </div>
        </div>
      )}

      {(tab === 'public' || privateUnlocked) && (
        <>
          {currentItems.length === 0 && <div className="ios-card p-5 text-sm text-gray-500 text-center">还没有内容，点击右上角上传。</div>}

          <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
            {currentItems.map(item => (
              <div key={item._id} className="ios-card-flat overflow-hidden bg-white">
                <div className="aspect-[3/4] bg-gray-100">
                  {item.type === 'video' ? (
                    <video src={item.url} controls className="w-full h-full object-cover" />
                  ) : (
                    <img src={item.url} alt="wall-item" className="w-full h-full object-cover" />
                  )}
                </div>
                <div className="px-3 py-2">
                  <div className="flex items-center justify-between text-xs ios-soft-text">
                    <span>{item.uploaderId === 'me' ? '我' : '她'}</span>
                    <span>{new Date(item.createdAt).toLocaleDateString()}</span>
                  </div>
                  {item.caption && <p className="text-sm text-gray-700 mt-1">{item.caption}</p>}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {showUploadSheet && (
        <div className="fixed inset-0 z-50 bg-black/35 flex items-end p-3" onClick={() => setShowUploadSheet(false)}>
          <div className="ios-card w-full p-5 space-y-4 animate__animated animate__slideInUp sheet-container" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="ios-title text-lg">上传到{tab === 'private' ? '私密墙' : '公共墙'}</h3>
              <button type="button" className="text-sm text-gray-500" onClick={() => setShowUploadSheet(false)}>
                取消
              </button>
            </div>

            <input className="ios-input px-3 py-2" placeholder="写一句描述（可选）" value={caption} onChange={e => setCaption(e.target.value)} />

            <div className="grid grid-cols-2 gap-3">
              <button type="button" className="ios-button-secondary py-3 inline-flex items-center justify-center gap-1" onClick={() => fileInputRef.current?.click()}>
                <ImagePlus size={16} /> 图片/视频
              </button>
              <button type="button" className="ios-button-primary py-3 inline-flex items-center justify-center gap-1" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                <Eye size={16} /> {uploading ? '上传中...' : '选择文件'}
              </button>
            </div>

            <p className="text-xs text-gray-500 inline-flex items-center gap-1">
              <Video size={12} /> 支持上传图片和长视频
            </p>
          </div>
        </div>
      )}

      <input ref={fileInputRef} type="file" accept="image/*,video/*" className="hidden" onChange={handleUpload} />
    </div>
  )
}

export default PhotoWallPage
