// pages/ChatPage.tsx
import React, { useEffect, useRef, useState } from 'react'
import {
  fetchMessages,
  sendFileMessage,
  sendTextMessage,
  Message,
  Sender
} from '../services/chatService'

const ChatPage: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [senderId, setSenderId] = useState<Sender>('me')
  const [loading, setLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement | null>(null)

  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }

  const loadMessages = async () => {
    setLoading(true)
    try {
      const data = await fetchMessages()
      setMessages(data)
      setTimeout(scrollToBottom, 100)
    } finally {
      setLoading(false)
    }
  }

  const handleSend = async () => {
    if (!input.trim()) return
    await sendTextMessage(senderId, input)
    setInput('')
    await loadMessages()
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSend()
    }
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    await sendFileMessage(senderId, file)
    e.target.value = ''
    await loadMessages()
  }

  useEffect(() => {
    loadMessages()
    const timer = setInterval(loadMessages, 3000)
    return () => clearInterval(timer)
  }, [])

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <span>Lover&apos;s Secret</span>
        <select
          value={senderId}
          onChange={e => setSenderId(e.target.value as Sender)}
          style={styles.select}
        >
          <option value="me">我</option>
          <option value="her">她</option>
        </select>
      </div>

      <div style={styles.messages}>
        {loading && messages.length === 0 && (
          <div style={styles.system}>正在加载聊天记录...</div>
        )}

        {messages.map(m => (
          <div
            key={m._id}
            style={{
              ...styles.msgRow,
              justifyContent: m.senderId === 'me' ? 'flex-end' : 'flex-start'
            }}
          >
            <div
              style={{
                ...styles.msgBubble,
                backgroundColor: m.senderId === 'me' ? '#ff5a79' : '#3a3a3a'
              }}
            >
              {m.type === 'text' && <div>{m.content}</div>}

              {m.type === 'image' && m.url && (
                <img
                  src={m.url}
                  alt="img"
                  style={{ maxWidth: 220, borderRadius: 8 }}
                />
              )}

              {m.type === 'video' && m.url && (
                <video
                  src={m.url}
                  controls
                  style={{ maxWidth: 260, borderRadius: 8 }}
                />
              )}

              <div style={styles.time}>
                {m.createdAt
                  ? new Date(m.createdAt).toLocaleString()
                  : ''}
              </div>
            </div>
          </div>
        ))}

        <div ref={messagesEndRef} />
      </div>

      <div style={styles.inputBar}>
        <input
          type="file"
          accept="image/*,video/*"
          onChange={handleFileChange}
          style={styles.fileInput}
        />

        <input
          style={styles.textInput}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="说点什么..."
        />

        <button style={styles.sendBtn} onClick={handleSend}>
          发送
        </button>
      </div>
    </div>
  )
}

// 底部导航栏的高度（你那排“聊天/纪念日/朋友圈/相册/设置”大概有多高）
// 不够可以之后调成 70、80
const NAV_HEIGHT = 60  // 底部导航大概高度，之后可以微调

const styles: { [k: string]: React.CSSProperties } = {
  page: {
    position: 'relative',
    minHeight: '100vh',
    // 为“聊天输入栏 + 底部导航栏”预留空间，避免聊天内容被压住
    paddingBottom: NAV_HEIGHT + 56,
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
    // 聊天内容区域高度 = 屏幕高度 - 导航栏高度 - 输入栏高度（约 56px）
    maxHeight: `calc(100vh - ${NAV_HEIGHT + 56}px)`
  },
  msgRow: {
    display: 'flex',
    marginBottom: 8
  },
  msgBubble: {
    maxWidth: '70%',
    padding: '8px 10px',
    borderRadius: 16,
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    backgroundColor: '#ffffff',
    boxShadow: '0 1px 3px rgba(0,0,0,0.06)'
  },
  time: {
    fontSize: 10,
    opacity: 0.6,
    marginTop: 4,
    alignSelf: 'flex-end'
  },
  system: {
    textAlign: 'center',
    color: '#999',
    fontSize: 12,
    marginTop: 12
  },
  inputBar: {
    // 关键：固定在视口底部，而不是跟着内容流动
    position: 'fixed',
    left: 0,
    right: 0,
    // 放在“底部导航栏上面”
    bottom: NAV_HEIGHT,
    padding: '8px 10px',
    borderTop: '1px solid #e5e5e5',
    display: 'flex',
    gap: 6,
    alignItems: 'center',
    background: '#ffffff',
    zIndex: 10,        // 保证不被其他元素盖住
    boxSizing: 'border-box'
  },
  fileInput: {
    flexShrink: 0
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
