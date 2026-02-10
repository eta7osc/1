import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Clock3, Heart, ImagePlus, Lock, Mic, Send, SmilePlus, Square, Sticker, UserCircle2 } from 'lucide-react'
import {
  EmojiPackItem,
  fetchEmojiPacks,
  fetchMessages,
  markPrivateMessageViewed,
  Message,
  saveEmojiPackFromMessage,
  sendEmojiMessage,
  sendFileMessage,
  sendTextMessage,
  Sender,
  uploadEmojiPack
} from '../services/chatService'

const POLL_INTERVAL_MS = 5000
const MAX_VOICE_SECONDS = 60
const DESTRUCT_OPTIONS = [
  { label: '关闭', value: 0 },
  { label: '30 秒', value: 30 },
  { label: '5 分钟', value: 300 },
  { label: '1 小时', value: 3600 },
  { label: '1 天', value: 86400 }
]

interface ChatPageProps {
  currentSender: Sender
  currentUserLabel: string
  currentUserAvatar?: string
  avatarMap?: Partial<Record<Sender, string>>
}

function isMessageDestroyed(message: Message, nowMs: number) {
  if (!message.destructAt) {
    return false
  }
  return new Date(message.destructAt).getTime() <= nowMs
}

function remainingSeconds(message: Message, nowMs: number) {
  if (!message.destructAt) {
    return 0
  }
  return Math.max(0, Math.ceil((new Date(message.destructAt).getTime() - nowMs) / 1000))
}

function getVoiceMimeType() {
  if (typeof MediaRecorder === 'undefined') {
    return undefined
  }

  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4']
  return candidates.find(type => MediaRecorder.isTypeSupported(type))
}

const ChatPage: React.FC<ChatPageProps> = ({ currentSender, currentUserLabel, currentUserAvatar, avatarMap }) => {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [privateMode, setPrivateMode] = useState(false)
  const [destructSeconds, setDestructSeconds] = useState(300)
  const [showEmojiPanel, setShowEmojiPanel] = useState(false)
  const [emojiPacks, setEmojiPacks] = useState<EmojiPackItem[]>([])
  const [emojiLoading, setEmojiLoading] = useState(false)
  const [nowMs, setNowMs] = useState(Date.now())
  const [isRecording, setIsRecording] = useState(false)
  const [recordingSeconds, setRecordingSeconds] = useState(0)

  const isLoadingRef = useRef(false)
  const pollTimerRef = useRef<number | null>(null)
  const messagesEndRef = useRef<HTMLDivElement | null>(null)
  const mediaInputRef = useRef<HTMLInputElement | null>(null)
  const emojiUploadRef = useRef<HTMLInputElement | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const recordingTimerRef = useRef<number | null>(null)
  const recordingSecondsRef = useRef(0)

  const scrollToBottom = useCallback(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [])

  const loadMessages = useCallback(async (showLoading = false) => {
    if (isLoadingRef.current) {
      return
    }

    try {
      isLoadingRef.current = true
      if (showLoading) {
        setLoading(true)
      }

      const data = await fetchMessages()
      setMessages(data)
      setError('')
    } catch (err) {
      console.error('[Chat] load messages failed', err)
      setError('消息加载失败，请检查网络或云开发配置')
    } finally {
      isLoadingRef.current = false
      if (showLoading) {
        setLoading(false)
      }
    }
  }, [])

  const loadEmojiPacks = useCallback(async () => {
    try {
      setEmojiLoading(true)
      const data = await fetchEmojiPacks()
      setEmojiPacks(data)
    } catch (err) {
      console.error('[Chat] load emoji packs failed', err)
      setError('表情包加载失败')
    } finally {
      setEmojiLoading(false)
    }
  }, [])

  const startPolling = useCallback(() => {
    if (pollTimerRef.current) {
      window.clearInterval(pollTimerRef.current)
    }

    pollTimerRef.current = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        loadMessages(false)
      }
    }, POLL_INTERVAL_MS)
  }, [loadMessages])

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) {
      window.clearInterval(pollTimerRef.current)
      pollTimerRef.current = null
    }
  }, [])

  const clearRecordingTimer = useCallback(() => {
    if (recordingTimerRef.current) {
      window.clearInterval(recordingTimerRef.current)
      recordingTimerRef.current = null
    }
  }, [])

  const handleSendText = useCallback(async () => {
    const text = input.trim()
    if (!text || sending || isRecording) {
      return
    }

    setInput('')
    setSending(true)
    setError('')

    const tempId = `local-${Date.now()}`
    const tempMsg: Message = {
      _id: tempId,
      roomId: 'couple-room',
      senderId: currentSender,
      type: 'text',
      content: text,
      createdAt: new Date().toISOString()
    }

    setMessages(prev => [...prev, tempMsg])

    try {
      await sendTextMessage(currentSender, text)
      await loadMessages(false)
    } catch (err) {
      console.error('[Chat] send text failed', err)
      setMessages(prev => prev.filter(message => message._id !== tempId))
      setInput(text)
      setError('发送失败，请稍后重试')
    } finally {
      setSending(false)
    }
  }, [currentSender, input, isRecording, loadMessages, sending])

  const handleSendMedia = useCallback(
    async (file: File) => {
      setSending(true)
      setError('')

      const isVideo = file.type.startsWith('video/')
      const tempId = `local-file-${Date.now()}`
      const tempMsg: Message = {
        _id: tempId,
        roomId: 'couple-room',
        senderId: currentSender,
        type: isVideo ? 'video' : 'image',
        content: '',
        createdAt: new Date().toISOString(),
        privateMedia: privateMode,
        selfDestructSeconds: privateMode ? destructSeconds : undefined
      }

      setMessages(prev => [...prev, tempMsg])

      try {
        await sendFileMessage(currentSender, file, {
          privateMedia: privateMode,
          selfDestructSeconds: privateMode ? destructSeconds : undefined
        })
        await loadMessages(false)
      } catch (err) {
        console.error('[Chat] send media failed', err)
        setMessages(prev => prev.filter(message => message._id !== tempId))
        setError(err instanceof Error ? err.message : '媒体发送失败')
      } finally {
        setSending(false)
      }
    },
    [currentSender, destructSeconds, loadMessages, privateMode]
  )

  const handleSendAudio = useCallback(
    async (blob: Blob, durationSeconds: number) => {
      const safeSeconds = Math.min(MAX_VOICE_SECONDS, Math.max(1, Math.floor(durationSeconds)))
      const ext = blob.type.includes('mp4') ? 'm4a' : 'webm'
      const file = new File([blob], `voice-${Date.now()}.${ext}`, { type: blob.type || 'audio/webm' })

      setSending(true)
      setError('')

      const tempId = `local-audio-${Date.now()}`
      const tempMsg: Message = {
        _id: tempId,
        roomId: 'couple-room',
        senderId: currentSender,
        type: 'audio',
        content: `语音 ${safeSeconds}s`,
        createdAt: new Date().toISOString()
      }

      setMessages(prev => [...prev, tempMsg])

      try {
        await sendFileMessage(currentSender, file)
        await loadMessages(false)
      } catch (err) {
        console.error('[Chat] send audio failed', err)
        setMessages(prev => prev.filter(message => message._id !== tempId))
        setError(err instanceof Error ? err.message : '语音发送失败')
      } finally {
        setSending(false)
      }
    },
    [currentSender, loadMessages]
  )

  const handleStopRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current
    if (!recorder) {
      return
    }

    if (recorder.state !== 'inactive') {
      recorder.stop()
    }

    clearRecordingTimer()
    setIsRecording(false)
  }, [clearRecordingTimer])

  const handleStartRecording = useCallback(async () => {
    if (sending || isRecording) {
      return
    }

    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setError('当前设备不支持语音录制')
      return
    }

    try {
      setError('')
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mimeType = getVoiceMimeType()
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream)

      audioChunksRef.current = []
      recordingSecondsRef.current = 0
      setRecordingSeconds(0)
      setIsRecording(true)
      mediaRecorderRef.current = recorder

      recorder.ondataavailable = event => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      recorder.onstop = async () => {
        stream.getTracks().forEach(track => track.stop())
        const chunks = audioChunksRef.current
        audioChunksRef.current = []
        mediaRecorderRef.current = null

        const duration = recordingSecondsRef.current
        if (chunks.length === 0 || duration <= 0) {
          return
        }

        const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' })
        await handleSendAudio(blob, duration)
      }

      recorder.start()
      clearRecordingTimer()
      recordingTimerRef.current = window.setInterval(() => {
        const next = recordingSecondsRef.current + 1
        recordingSecondsRef.current = next
        setRecordingSeconds(next)

        if (next >= MAX_VOICE_SECONDS) {
          handleStopRecording()
        }
      }, 1000)
    } catch (err) {
      console.error('[Chat] start recording failed', err)
      setIsRecording(false)
      clearRecordingTimer()
      setError(err instanceof Error ? err.message : '无法开始录音，请检查麦克风权限')
    }
  }, [clearRecordingTimer, handleSendAudio, handleStopRecording, isRecording, sending])

  const handleMediaInput = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      e.target.value = ''
      if (!file || sending || isRecording) {
        return
      }
      await handleSendMedia(file)
    },
    [handleSendMedia, isRecording, sending]
  )

  const handleEmojiUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''

    if (!file || sending || isRecording) {
      return
    }

    try {
      setSending(true)
      await uploadEmojiPack(currentSender, file)
      await loadEmojiPacks()
      setShowEmojiPanel(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : '上传表情包失败')
    } finally {
      setSending(false)
    }
  }

  const handleSendEmoji = async (fileId: string) => {
    try {
      setSending(true)
      await sendEmojiMessage(currentSender, fileId)
      await loadMessages(false)
      setShowEmojiPanel(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : '发送表情包失败')
    } finally {
      setSending(false)
    }
  }

  const handleSaveEmojiFromMessage = async (message: Message) => {
    if (!message.fileId) {
      return
    }

    try {
      setError('')
      await saveEmojiPackFromMessage(currentSender, message.fileId)
      await loadEmojiPacks()
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存表情包失败')
    }
  }

  const handleViewPrivateMessage = async (message: Message) => {
    try {
      await markPrivateMessageViewed(message)
      await loadMessages(false)
    } catch (err) {
      console.error('[Chat] mark viewed failed', err)
      setError('开启私密内容失败，请重试')
    }
  }

  useEffect(() => {
    loadMessages(true)
    startPolling()

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        loadMessages(false)
        startPolling()
      } else {
        stopPolling()
      }
    }

    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange)
      stopPolling()
    }
  }, [loadMessages, startPolling, stopPolling])

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    if (showEmojiPanel) {
      loadEmojiPacks()
    }
  }, [showEmojiPanel, loadEmojiPacks])

  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  useEffect(() => {
    return () => {
      clearRecordingTimer()
      const recorder = mediaRecorderRef.current
      if (recorder && recorder.state !== 'inactive') {
        recorder.stop()
      }
    }
  }, [clearRecordingTimer])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSendText()
    }
  }

  const activeMessages = useMemo(() => messages.filter(message => !isMessageDestroyed(message, nowMs)), [messages, nowMs])

  return (
    <div className="ios-page h-full min-h-0 flex flex-col">
      <header className="ios-blur ios-safe-top px-4 pb-3 border-b border-white/70 shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="ios-title text-xl">Lover&apos;s Secret</h1>
            <p className="text-xs ios-soft-text mt-0.5">当前账号：{currentUserLabel}</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-full overflow-hidden bg-rose-100 text-rose-400 flex items-center justify-center border border-rose-200/80">
              {currentUserAvatar ? <img src={currentUserAvatar} alt="my-avatar" className="h-full w-full object-cover" /> : <UserCircle2 size={24} />}
            </div>
            <span className="ios-chip ios-chip-pink">私密聊天</span>
            <span className="ios-feature-badge">
              <Heart size={11} /> 两人专属
            </span>
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between text-[11px] ios-soft-text">
          <span>只属于你们的加密日常</span>
          <span className={privateMode ? 'text-rose-500 font-semibold' : ''}>{privateMode ? '私密媒体已开启' : '私密媒体已关闭'}</span>
        </div>
      </header>

      <main className="flex-1 min-h-0 ios-scroll px-3 py-3 space-y-2 ios-chat-bg">
        {loading && activeMessages.length === 0 && <div className="text-center text-xs text-gray-400">正在加载聊天记录...</div>}
        {!loading && activeMessages.length === 0 && <div className="text-center text-xs text-gray-400">还没有消息，发一条试试</div>}

        {activeMessages.map(message => {
          const isMine = message.senderId === currentSender
          const avatarUrl = message.senderId === currentSender ? currentUserAvatar || avatarMap?.[currentSender] : avatarMap?.[message.senderId]
          const isPrivate = Boolean(message.privateMedia && (message.type === 'image' || message.type === 'video'))
          const isLocked = isPrivate && message.senderId !== currentSender && !message.viewedAt
          const leftSeconds = remainingSeconds(message, nowMs)

          return (
            <div key={message._id} className={`w-full flex items-end gap-2 ${isMine ? 'justify-start flex-row-reverse' : 'justify-start'}`}>
              <div className="h-9 w-9 rounded-full overflow-hidden bg-rose-100 text-rose-400 border border-rose-200/80 shrink-0 flex items-center justify-center">
                {avatarUrl ? <img src={avatarUrl} alt="chat-avatar" className="h-full w-full object-cover" /> : <UserCircle2 size={20} />}
              </div>
              <div className={`max-w-[78%] relative ${isMine ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
                <div
                  className={`rounded-2xl px-3 py-2 shadow-sm border ${
                    isMine
                      ? 'bg-[linear-gradient(135deg,#ff7fa4,#ff4f7a)] text-white border-rose-300/50'
                      : 'bg-white/95 text-gray-800 border-rose-100'
                  }`}
                >
                  {message.type === 'text' && <p className="whitespace-pre-wrap break-words text-[15px]">{message.content}</p>}

                  {message.type === 'emoji' && message.url && (
                    <img src={message.url} alt="emoji" className="w-20 h-20 object-cover rounded-2xl" />
                  )}

                  {(message.type === 'image' || message.type === 'video') && isPrivate && (
                    <div className="mb-1 inline-flex items-center gap-1 text-[11px] font-semibold rounded-full px-2 py-0.5 bg-black/15 text-white">
                      <Lock size={11} /> 阅后即焚
                    </div>
                  )}

                  {(message.type === 'image' || message.type === 'video') && isLocked && (
                    <button
                      type="button"
                      onClick={() => handleViewPrivateMessage(message)}
                      className="block w-full text-left rounded-xl bg-black/30 px-3 py-5 text-white"
                    >
                      点击查看私密内容
                    </button>
                  )}

                  {(message.type === 'image' || message.type === 'video') && !isLocked && (
                    <>
                      {message.type === 'image' && message.url && <img src={message.url} alt="chat-media" className="max-w-[240px] rounded-xl" />}
                      {message.type === 'video' && message.url && <video src={message.url} controls className="max-w-[260px] rounded-xl" />}
                      {!message.url && <div className="text-xs opacity-80">上传中...</div>}
                    </>
                  )}

                  {message.type === 'audio' && (
                    <>
                      {message.url ? (
                        <audio src={message.url} controls className={isMine ? 'w-56 accent-white' : 'w-56'} preload="metadata" />
                      ) : (
                        <div className="text-xs opacity-80">语音上传中...</div>
                      )}
                    </>
                  )}
                </div>

                <div className="flex items-center gap-2 px-1 text-[10px] text-gray-400">
                  <span>{new Date(message.createdAt).toLocaleTimeString()}</span>
                  {isPrivate && message.destructAt && leftSeconds > 0 && (
                    <span className="ios-chip ios-chip-danger !py-0 !px-2 !text-[10px] inline-flex items-center gap-1">
                      <Clock3 size={10} /> {leftSeconds}s
                    </span>
                  )}
                </div>

                {message.type === 'image' && message.fileId && (
                  <button
                    type="button"
                    onClick={() => handleSaveEmojiFromMessage(message)}
                    className="text-[11px] text-rose-500 px-1"
                  >
                    保存为表情包
                  </button>
                )}
              </div>
            </div>
          )
        })}

        {error && <div className="text-center text-xs text-red-500 py-2">{error}</div>}
        <div ref={messagesEndRef} />
      </main>

      {showEmojiPanel && (
        <section className="border-t border-rose-100 bg-white/95 px-3 py-2 max-h-52 ios-scroll shrink-0">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-gray-600">爱的表情包</h3>
            <button type="button" className="text-xs text-rose-500" onClick={() => emojiUploadRef.current?.click()}>
              上传表情
            </button>
          </div>
          {emojiLoading && <div className="text-xs text-gray-400">加载中...</div>}
          {!emojiLoading && emojiPacks.length === 0 && <div className="text-xs text-gray-400">暂无表情包，先上传一张吧</div>}
          <div className="grid grid-cols-6 gap-2">
            {emojiPacks.map(item => (
              <button
                key={item._id}
                type="button"
                className="rounded-xl overflow-hidden bg-gray-100 aspect-square"
                onClick={() => handleSendEmoji(item.fileId)}
              >
                {item.url && <img src={item.url} alt="emoji-pack" className="w-full h-full object-cover" />}
              </button>
            ))}
          </div>
        </section>
      )}

      <footer className="ios-blur ios-safe-bottom border-t border-white/80 px-3 py-2 space-y-2 shrink-0">
        <div className="flex items-center gap-2 text-xs text-gray-600">
          <button
            type="button"
            onClick={() => setPrivateMode(prev => !prev)}
            className={`ios-pill px-3 py-1 ${privateMode ? 'text-rose-500 border-rose-300 bg-rose-50' : ''}`}
            disabled={isRecording}
          >
            {privateMode ? '私密媒体: 开启' : '私密媒体: 关闭'}
          </button>

          <select
            className="ios-pill px-2 py-1 bg-white"
            value={destructSeconds}
            onChange={e => setDestructSeconds(Number(e.target.value))}
            disabled={!privateMode || isRecording}
          >
            {DESTRUCT_OPTIONS.map(option => (
              <option key={option.value} value={option.value}>
                销毁时间: {option.label}
              </option>
            ))}
          </select>

          {isRecording && <span className="text-rose-500 font-semibold">录音中 {recordingSeconds}s / {MAX_VOICE_SECONDS}s</span>}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            className="ios-button-secondary h-10 w-10 flex items-center justify-center"
            onClick={() => mediaInputRef.current?.click()}
            disabled={sending || isRecording}
          >
            <ImagePlus size={18} />
          </button>

          <input
            className="ios-input px-3 py-2"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isRecording ? '录音中，停止后可输入文本...' : '说点什么...'}
            disabled={sending || isRecording}
          />

          <button
            type="button"
            className={`ios-button-secondary h-10 w-10 flex items-center justify-center ${isRecording ? 'opacity-60' : ''}`}
            onClick={() => setShowEmojiPanel(prev => !prev)}
            disabled={isRecording}
          >
            <Sticker size={17} />
          </button>

          <button
            type="button"
            className={`h-10 w-10 flex items-center justify-center rounded-xl text-white ${isRecording ? 'bg-rose-500' : 'bg-sky-500'} disabled:opacity-60`}
            onClick={isRecording ? handleStopRecording : handleStartRecording}
            disabled={sending}
            title={isRecording ? '停止录音并发送' : '录制语音'}
          >
            {isRecording ? <Square size={15} /> : <Mic size={16} />}
          </button>

          <button
            type="button"
            className="ios-button-primary h-10 w-10 flex items-center justify-center disabled:opacity-60"
            onClick={handleSendText}
            disabled={sending || !input.trim() || isRecording}
          >
            <Send size={16} />
          </button>
        </div>

        <div className="flex items-center justify-between text-[11px] text-gray-500">
          <span>支持发送图片、长视频、最长 60 秒语音</span>
          <button type="button" className="text-rose-500 inline-flex items-center gap-1" onClick={() => emojiUploadRef.current?.click()}>
            <SmilePlus size={12} /> 导入表情
          </button>
        </div>
      </footer>

      <input ref={mediaInputRef} type="file" accept="image/*,video/*" className="hidden" onChange={handleMediaInput} />
      <input ref={emojiUploadRef} type="file" accept="image/*" className="hidden" onChange={handleEmojiUpload} />
    </div>
  )
}

export default ChatPage
