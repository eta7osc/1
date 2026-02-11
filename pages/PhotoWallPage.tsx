import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Eye, Heart, ImagePlus, Lock, ShieldAlert, Video } from 'lucide-react'
import { STORAGE_KEYS } from '../constants'
import type { Sender } from '../services/chatService'
import { createWallItem, fetchWallItems, WallItem } from '../services/photoWallService'

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
  const [error, setError] = useState('')
  const [privateUnlocked, setPrivateUnlocked] = useState(false)
  const [password, setPassword] = useState('')
  const [caption, setCaption] = useState('')
  const [showUploadSheet, setShowUploadSheet] = useState(false)

  const privatePassword = useMemo(() => {
    const envPassword = import.meta.env.VITE_PRIVATE_WALL_PASSWORD || ''
    if (envPassword.trim()) {
      return envPassword.trim()
    }

    const rawPasscode = localStorage.getItem(STORAGE_KEYS.PASSCODE) || ''
    if (!rawPasscode) {
      return ''
    }

    try {
      return JSON.parse(rawPasscode)
    } catch {
      return rawPasscode
    }
  }, [])

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
      setError('私密照片墙密码未配置，请设置 VITE_PRIVATE_WALL_PASSWORD')
      return
    }

    if (password.trim() !== privatePassword) {
      setError('密码错误')
      return
    }

    setPrivateUnlocked(true)
    setError('')
    setPassword('')

    try {
      await loadPrivate()
    } catch {
      setError('私密照片墙加载失败')
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

      {tab === 'private' && !privateUnlocked && (
        <div className="ios-card p-5 space-y-4">
          <div className="flex items-center gap-2 text-gray-700">
            <Lock size={18} />
            <h3 className="font-semibold">输入密码进入私密照片墙</h3>
          </div>
          <input
            className="ios-input px-3 py-2"
            type="password"
            placeholder="私密照片墙密码"
            value={password}
            onChange={e => setPassword(e.target.value)}
          />
          <button type="button" className="ios-button-primary w-full py-3" onClick={handleUnlockPrivate}>
            解锁私密墙
          </button>
          {!privatePassword && (
            <div className="text-xs text-orange-500 inline-flex items-center gap-1">
              <ShieldAlert size={13} /> 未配置 `VITE_PRIVATE_WALL_PASSWORD`，请先配置后重新构建。
            </div>
          )}
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
