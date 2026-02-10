import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Heart, MessageCircle, Plus, Send, Video } from 'lucide-react'
import type { Sender } from '../services/chatService'
import { addHomeComment, createHomePost, fetchHomePosts, HomePost, toggleHomeLike } from '../services/homeService'

interface HomePageProps {
  currentSender: Sender
}

interface DraftFile {
  file: File
  previewUrl: string
  type: 'image' | 'video'
}

const POLL_INTERVAL_MS = 5000

function roleLabel(sender: Sender) {
  return sender === 'me' ? '我' : '她'
}

const HomePage: React.FC<HomePageProps> = ({ currentSender }) => {
  const [posts, setPosts] = useState<HomePost[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showComposer, setShowComposer] = useState(false)
  const [content, setContent] = useState('')
  const [draftFiles, setDraftFiles] = useState<DraftFile[]>([])
  const [publishing, setPublishing] = useState(false)
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({})

  const draftFilesRef = useRef<DraftFile[]>([])

  const cleanupDraftFiles = useCallback((files: DraftFile[]) => {
    files.forEach(item => URL.revokeObjectURL(item.previewUrl))
  }, [])

  useEffect(() => {
    draftFilesRef.current = draftFiles
  }, [draftFiles])

  useEffect(() => {
    return () => {
      cleanupDraftFiles(draftFilesRef.current)
    }
  }, [cleanupDraftFiles])

  const loadPosts = useCallback(async (withLoading = false) => {
    try {
      if (withLoading) {
        setLoading(true)
      }
      const data = await fetchHomePosts()
      setPosts(data)
      setError('')
    } catch (err) {
      console.error('[Home] load posts failed', err)
      setError('加载家页面失败，请检查网络或云开发配置')
    } finally {
      if (withLoading) {
        setLoading(false)
      }
    }
  }, [])

  useEffect(() => {
    loadPosts(true)
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        loadPosts(false)
      }
    }, POLL_INTERVAL_MS)

    return () => {
      window.clearInterval(timer)
    }
  }, [loadPosts])

  const handleSelectFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    e.target.value = ''
    if (files.length === 0) {
      return
    }

    const next = files.map(file => ({
      file,
      previewUrl: URL.createObjectURL(file),
      type: file.type.startsWith('video/') ? 'video' : 'image'
    }))

    setDraftFiles(prev => [...prev, ...next])
  }

  const clearComposer = useCallback(() => {
    cleanupDraftFiles(draftFilesRef.current)
    setDraftFiles([])
    setContent('')
    setShowComposer(false)
  }, [cleanupDraftFiles])

  const handlePublish = async () => {
    if (!content.trim() && draftFiles.length === 0) {
      setError('请输入内容或上传媒体')
      return
    }

    try {
      setPublishing(true)
      setError('')
      await createHomePost(
        currentSender,
        content,
        draftFiles.map(item => item.file)
      )
      clearComposer()
      await loadPosts(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : '发布失败，请稍后重试')
    } finally {
      setPublishing(false)
    }
  }

  const handleToggleLike = async (postId: string) => {
    try {
      await toggleHomeLike(postId, currentSender)
      await loadPosts(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : '点赞失败')
    }
  }

  const handleSubmitComment = async (postId: string) => {
    const text = (commentInputs[postId] || '').trim()
    if (!text) {
      return
    }

    try {
      await addHomeComment(postId, currentSender, text)
      setCommentInputs(prev => ({ ...prev, [postId]: '' }))
      await loadPosts(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : '评论失败')
    }
  }

  const headerTitle = useMemo(() => `欢迎回家，${roleLabel(currentSender)}`, [currentSender])

  return (
    <div className="ios-page ios-scroll pb-32 px-4 ios-safe-top space-y-4">
      <div className="ios-card p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="ios-title text-2xl">家</h2>
            <p className="text-sm text-gray-500 mt-1">{headerTitle}</p>
          </div>
          <button type="button" className="ios-button-primary px-4 py-2 text-sm" onClick={() => setShowComposer(true)}>
            <span className="inline-flex items-center gap-1">
              <Plus size={16} /> 发布
            </span>
          </button>
        </div>
      </div>

      {loading && <div className="text-center text-sm text-gray-400">加载中...</div>}
      {error && <div className="text-center text-sm text-red-500">{error}</div>}

      {!loading && posts.length === 0 && (
        <div className="ios-card p-5 text-sm text-gray-500 text-center">还没有动态，发布第一条日常吧。</div>
      )}

      <div className="space-y-4">
        {posts.map(post => {
          const liked = post.likes.includes(currentSender)
          return (
            <article key={post._id} className="ios-card p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="ios-chip ios-chip-info">{roleLabel(post.authorId)}</div>
                <span className="text-xs text-gray-400">{new Date(post.createdAt).toLocaleString()}</span>
              </div>

              {post.content && <p className="text-[15px] leading-relaxed text-gray-800 whitespace-pre-wrap">{post.content}</p>}

              {post.media.length > 0 && (
                <div className={`grid gap-2 ${post.media.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
                  {post.media.map((media, index) => (
                    <div key={`${post._id}-${index}`} className="overflow-hidden rounded-2xl bg-black/5">
                      {media.type === 'video' ? (
                        <video src={media.url} controls className="w-full max-h-72 object-cover" />
                      ) : (
                        <img src={media.url} alt="home-media" className="w-full max-h-72 object-cover" />
                      )}
                    </div>
                  ))}
                </div>
              )}

              <div className="flex items-center gap-4 pt-1">
                <button
                  type="button"
                  onClick={() => handleToggleLike(post._id)}
                  className={`inline-flex items-center gap-1 text-sm ${liked ? 'text-pink-500' : 'text-gray-500'}`}
                >
                  <Heart size={16} className={liked ? 'fill-pink-500' : ''} />
                  {post.likes.length}
                </button>
                <span className="inline-flex items-center gap-1 text-sm text-gray-500">
                  <MessageCircle size={16} />
                  {post.comments.length}
                </span>
              </div>

              <div className="space-y-2">
                {post.comments.map(comment => (
                  <div key={comment.id} className="rounded-xl bg-gray-100 px-3 py-2 text-sm">
                    <span className="font-semibold text-blue-500 mr-1">{roleLabel(comment.authorId)}</span>
                    <span>{comment.content}</span>
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <input
                  value={commentInputs[post._id] || ''}
                  onChange={e => setCommentInputs(prev => ({ ...prev, [post._id]: e.target.value }))}
                  className="ios-input px-3 py-2 text-sm"
                  placeholder="写评论..."
                />
                <button
                  type="button"
                  onClick={() => handleSubmitComment(post._id)}
                  className="ios-button-secondary h-10 w-10 flex items-center justify-center"
                >
                  <Send size={15} />
                </button>
              </div>
            </article>
          )
        })}
      </div>

      {showComposer && (
        <div className="fixed inset-0 z-50 bg-black/40 p-4 flex items-end">
          <div className="ios-card w-full p-4 space-y-4 animate__animated animate__slideInUp">
            <div className="flex items-center justify-between">
              <h3 className="ios-title text-lg">发布日常</h3>
              <button type="button" className="text-sm text-gray-500" onClick={clearComposer}>
                取消
              </button>
            </div>

            <textarea
              className="ios-input px-3 py-2 min-h-24 resize-none"
              value={content}
              onChange={e => setContent(e.target.value)}
              placeholder="记录今天的点滴..."
            />

            {draftFiles.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {draftFiles.map((item, index) => (
                  <div key={index} className="rounded-xl overflow-hidden bg-gray-100 relative aspect-square">
                    {item.type === 'video' ? (
                      <video src={item.previewUrl} className="w-full h-full object-cover" />
                    ) : (
                      <img src={item.previewUrl} className="w-full h-full object-cover" />
                    )}
                    {item.type === 'video' && (
                      <span className="absolute top-1 right-1 text-[10px] px-1.5 py-0.5 rounded-full bg-black/50 text-white inline-flex items-center gap-1">
                        <Video size={10} /> 视频
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center justify-between gap-3">
              <label className="ios-button-secondary px-4 py-2 text-sm cursor-pointer inline-flex items-center gap-1">
                <Plus size={16} /> 添加媒体
                <input type="file" accept="image/*,video/*" multiple className="hidden" onChange={handleSelectFiles} />
              </label>

              <button type="button" onClick={handlePublish} className="ios-button-primary px-5 py-2.5 text-sm" disabled={publishing}>
                {publishing ? '发布中...' : '发布'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default HomePage
