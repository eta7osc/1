// pages/ChatPage.tsx
import React, { useEffect, useRef, useState } from 'react'
import {
  fetchMessages,
  sendFileMessage,
  sendTextMessage,
  Message,
  Sender
} from '../services/chatService'

// 底部导航栏（“聊天 / 纪念日 / 朋友圈 / 相册 / 设置”）的大致高度
const NAV_HEIGHT = 60

const ChatPage: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [senderId, setSenderId] = useState<Sender>('me')
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement | null>(null)

  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }

  const loadMessages = async () => {
    try {
      setLoading(true)
      const data = await fetchMessages()
      setMessages(data)
      setTimeout(scrollToBottom, 100)
    } catch (err) {
      console.error('加载消息失败', err)
    } finally {
      setLoading(false)
    }
  }

  const handleSend = async () => {
    const text = input.trim()
    if (!text || sending) return

    console.log('[Chat] 点击发送按钮, text =', text, 'senderId =', senderId)

    // 先清空输入框，让用户感觉“发出去了”
    setInput('')
    setSending(true)

    // 构造一条“本地临时消息”，先插到列表里（乐观更新）
    const tempId = 'local-' + Date.now()
    const tempMsg: Message = {
      _id: tempId as any,
      senderId,
      type: 'text',
      content: text,
      createdAt: new Date().toISOString()
    } as Message

    setMessages(prev => [...prev, tempMsg])
    setTimeout(scrollToBottom, 50)

    try {
      await sendTextMessage(senderId, text)
      console.log('[Chat] 发送成功，即将重新拉取列表')
      await loadMessages()
    } catch (err) {
      console.error('[Chat] 发送失败', err)
      // 回滚临时消息 + 把内容放回输入框
      setMessages(prev => prev.filter(m => m._id !== tempId))
      setInput(text)
      alert('消息发送失败，请检查网络或后端配置（CloudBase / API）')
    } finally {
      setSending(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSend()
    }
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || sending) return

    console.log('[Chat] 发送附件', file)

    e.target.value = ''
    setSending(true)

    const tempId = 'local-file-' + Date.now()
    const tempMsg: Message = {
      _id: tempId as any,
      senderId,
      type: file.type.startsWith('video') ? 'video' : 'image',
      content: '',
      // 提前展示一张“本地预览”其实也可以，这里先简单处理
      createdAt: new Date().toISOString()
    } as Message

    setMessages(prev => [...prev, tempMsg])
    setTimeout(scrollToBottom, 50)

    try {
      await sendFileMessage(senderId, file)
      console.log('[Chat] 附件发送成功')
      await loadMessages()
    } catch (err) {
      console.error('[Chat] 附件发送失败', err)
      setMessages(prev => prev.filter(m => m._id !== tempId))
      alert('附件发送失败，请检查网络或后端配置')
    } finally {
      setSending(false)
    }
  }

  useEffect(() => {
    loadMessages()
    const timer = setInterval(loadMessages, 3000)
    return () => clearInterval(timer)
  }, [])

  return (
    <div style={styles.page}>
      {/* 顶部标题栏 */}
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

      {/* 消息列表 */}
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

      {/* 底部输入栏 - 固定在导航栏上方 */}
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

        <button
          style={{
            ...styles.sendBtn,
            opacity: sending || !input.trim() ? 0.6 : 1
          }}
          onClick={handleSend}
          disabled={sending || !input.trim()}
        >
          发送
        </button>
      </div>
    </div>
  )
}

const styles: { [k: string]: React.CSSProperties } = {
  page: {
    position: 'relative',
    minHeight: '100vh',
    paddingBottom: NAV_HEIGHT + 56, // 输入栏 + 底部导航预留空间
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
    position: 'fixed',
    left: 0,
    right: 0,
    bottom: NAV_HEIGHT, // 放在底部导航上面
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