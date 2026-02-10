import React, { useCallback, useEffect, useRef, useState } from 'react'
import { fetchMessages, Message, sendFileMessage, sendTextMessage, Sender } from '../services/chatService'

const NAV_HEIGHT = 60
const INPUT_BAR_HEIGHT = 56
const POLL_INTERVAL_MS = 5000

const ChatPage: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [senderId, setSenderId] = useState<Sender>('me')
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')

  const isLoadingRef = useRef(false)
  const pollTimerRef = useRef<number | null>(null)
  const messagesEndRef = useRef<HTMLDivElement | null>(null)

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

  const handleSend = useCallback(async () => {
    const text = input.trim()
    if (!text || sending) {
      return
    }

    setInput('')
    setSending(true)
    setError('')

    const tempId = `local-${Date.now()}`
    const tempMsg: Message = {
      _id: tempId,
      roomId: 'couple-room',
      senderId,
      type: 'text',
      content: text,
      createdAt: new Date().toISOString()
    }

    setMessages(prev => [...prev, tempMsg])

    try {
      await sendTextMessage(senderId, text)
      await loadMessages(false)
    } catch (err) {
      console.error('[Chat] send text failed', err)
      setMessages(prev => prev.filter(message => message._id !== tempId))
      setInput(text)
      setError('发送失败，请稍后重试')
    } finally {
      setSending(false)
    }
  }, [input, loadMessages, senderId, sending])

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      e.target.value = ''

      if (!file || sending) {
        return
      }

      setSending(true)
      setError('')

      const tempId = `local-file-${Date.now()}`
      const tempMsg: Message = {
        _id: tempId,
        roomId: 'couple-room',
        senderId,
        type: file.type.startsWith('video') ? 'video' : 'image',
        content: '',
        createdAt: new Date().toISOString()
      }

      setMessages(prev => [...prev, tempMsg])

      try {
        await sendFileMessage(senderId, file)
        await loadMessages(false)
      } catch (err) {
        console.error('[Chat] send file failed', err)
        setMessages(prev => prev.filter(message => message._id !== tempId))
        setError(err instanceof Error ? err.message : '附件发送失败，请稍后重试')
      } finally {
        setSending(false)
      }
    },
    [loadMessages, senderId, sending]
  )

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
    scrollToBottom()
  }, [messages, scrollToBottom])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <span>Lover&apos;s Secret</span>
        <select
          value={senderId}
          onChange={e => setSenderId(e.target.value as Sender)}
          style={styles.select}
          disabled={sending}
        >
          <option value="me">我</option>
          <option value="her">她</option>
        </select>
      </div>

      <div style={styles.messages}>
        {loading && messages.length === 0 && <div style={styles.system}>正在加载聊天记录...</div>}
        {!loading && messages.length === 0 && <div style={styles.system}>还没有消息，发一条试试</div>}

        {messages.map(message => (
          <div
            key={message._id}
            style={{
              ...styles.msgRow,
              justifyContent: message.senderId === 'me' ? 'flex-end' : 'flex-start'
            }}
          >
            <div
              style={{
                ...styles.msgBubble,
                backgroundColor: message.senderId === 'me' ? '#ff5a79' : '#3a3a3a'
              }}
            >
              {message.type === 'text' && <div>{message.content}</div>}
              {message.type === 'image' && message.url && <img src={message.url} alt="image" style={styles.image} />}
              {message.type === 'video' && message.url && <video src={message.url} controls style={styles.video} />}
              {(message.type === 'image' || message.type === 'video') && !message.url && (
                <div style={styles.pendingFile}>上传中...</div>
              )}

              <div style={styles.time}>{message.createdAt ? new Date(message.createdAt).toLocaleString() : ''}</div>
            </div>
          </div>
        ))}

        {error && <div style={styles.error}>{error}</div>}
        <div ref={messagesEndRef} />
      </div>

      <div style={styles.inputBar}>
        <input type="file" accept="image/*,video/*" onChange={handleFileChange} style={styles.fileInput} disabled={sending} />

        <input
          style={styles.textInput}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="说点什么..."
          disabled={sending}
        />

        <button
          style={{
            ...styles.sendBtn,
            opacity: sending || !input.trim() ? 0.6 : 1
          }}
          onClick={handleSend}
          disabled={sending || !input.trim()}
          type="button"
        >
          发送
        </button>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    position: 'relative',
    minHeight: '100vh',
    paddingBottom: NAV_HEIGHT + INPUT_BAR_HEIGHT,
    background: '#f5f5f7',
    color: '#333',
    fontFamily: 'system-ui,-apple-system,BlinkMacSystemFont',
    boxSizing: 'border-box'
  },
  header: {
    padding: '8px 12px',
    borderBottom: '1px solid #e5e5e5',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    background: '#ffffff'
  },
  select: {
    background: '#f5f5f7',
    color: '#333',
    borderRadius: 16,
    border: '1px solid #dddddd',
    padding: '4px 10px',
    fontSize: 12
  },
  messages: {
    padding: '10px 12px',
    background: '#f5f5f7',
    overflowY: 'auto',
    maxHeight: `calc(100vh - ${NAV_HEIGHT + INPUT_BAR_HEIGHT}px)`
  },
  msgRow: {
    display: 'flex',
    marginBottom: 8
  },
  msgBubble: {
    maxWidth: '72%',
    padding: '8px 10px',
    borderRadius: 16,
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    color: '#fff',
    backgroundColor: '#ffffff',
    boxShadow: '0 1px 3px rgba(0,0,0,0.06)'
  },
  image: {
    maxWidth: 220,
    borderRadius: 8
  },
  video: {
    maxWidth: 260,
    borderRadius: 8
  },
  pendingFile: {
    fontSize: 12,
    opacity: 0.85
  },
  time: {
    fontSize: 10,
    opacity: 0.7,
    marginTop: 4,
    alignSelf: 'flex-end'
  },
  system: {
    textAlign: 'center',
    color: '#999',
    fontSize: 12,
    marginTop: 12
  },
  error: {
    marginTop: 10,
    textAlign: 'center',
    color: '#d93c3c',
    fontSize: 12
  },
  inputBar: {
    position: 'fixed',
    left: 0,
    right: 0,
    bottom: NAV_HEIGHT,
    padding: '8px 10px',
    borderTop: '1px solid #e5e5e5',
    display: 'flex',
    gap: 6,
    alignItems: 'center',
    background: '#ffffff',
    zIndex: 10,
    boxSizing: 'border-box'
  },
  fileInput: {
    flexShrink: 0,
    maxWidth: 100
  },
  textInput: {
    flex: 1,
    padding: '8px 12px',
    borderRadius: 20,
    border: '1px solid #dddddd',
    outline: 'none',
    background: '#f5f5f7',
    color: '#333',
    fontSize: 14
  },
  sendBtn: {
    padding: '8px 16px',
    borderRadius: 20,
    border: 'none',
    background: '#ff7aa5',
    color: '#fff',
    fontSize: 14,
    cursor: 'pointer',
    boxShadow: '0 2px 6px rgba(255,122,165,0.4)',
    whiteSpace: 'nowrap'
  }
}

export default ChatPage
