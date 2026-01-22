import React, { useState, useEffect, useRef } from 'react';
import { Send, Image as ImageIcon, Video, Smile, Flame, CheckCheck } from 'lucide-react';
import { Message, MessageType } from '../types';
// 引入 MemFire 客户端 (请确保 services/memfire.ts 文件已创建)
import { supabase } from '../services/memfire'; 

// 模拟身份系统：检查本地存储，如果没有则默认为 'boy'
// 生产环境技巧：你可以在女友手机浏览器控制台输入 localStorage.setItem('userId', 'girl')
const CURRENT_USER_ID = localStorage.getItem('userId') || 'boy';

const ChatPage: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isBurning, setIsBurning] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // ----------------------------------------------------
  // 核心修改 1: 初始化与实时订阅 (替换原来的 storage.get)
  // ----------------------------------------------------
  useEffect(() => {
    // 1. 先加载历史记录
    fetchHistory();
    
    // 2. 开启实时监听 (当数据库有新消息，立刻推送到前端)
    const channel = supabase
      .channel('chat-room')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload) => {
          // 收到新消息 -> 转换格式 -> 追加到列表
          const newMsg = formatMessageFromDB(payload.new);
          setMessages((prev) => [...prev, newMsg]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // 自动滚动到底部
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // 阅后即焚倒计时逻辑 (保持不变，只做本地视觉过滤)
  useEffect(() => {
    const timer = setInterval(() => {
      const now = Date.now();
      setMessages(prev => {
        // 过滤掉：设定了销毁时间 且 时间已到 的消息
        const filtered = prev.filter(m => !m.destructAt || m.destructAt > now);
        // 为了性能，只有当长度变化时才更新状态
        if (filtered.length !== prev.length) {
          return filtered;
        }
        return prev;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // ----------------------------------------------------
  // 辅助函数: 数据库格式 -> 前端格式转换器
  // ----------------------------------------------------
  const formatMessageFromDB = (dbRecord: any): Message => {
    return {
      id: dbRecord.id,
      // 关键逻辑：如果数据库里的 sender_id 等于当前用户的 ID，就是 'me'，否则是 'partner'
      senderId: dbRecord.sender_id === CURRENT_USER_ID ? 'me' : 'partner', 
      content: dbRecord.content,
      type: dbRecord.type as MessageType,
      timestamp: new Date(dbRecord.created_at).getTime(),
      isRead: dbRecord.is_read,
      selfDestruct: dbRecord.self_destruct,
      destructAt: dbRecord.destruct_at ? Number(dbRecord.destruct_at) : undefined
    };
  };

  const fetchHistory = async () => {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .order('created_at', { ascending: true }); // 按时间顺序排列
    
    if (data) {
      setMessages(data.map(formatMessageFromDB));
    }
  };

  // ----------------------------------------------------
  // 核心修改 2: 发送消息逻辑 (替换 setMessages 为 supabase.insert)
  // ----------------------------------------------------
  const handleSend = async () => {
    if (!inputText.trim()) return;
    
    const textToSend = inputText;
    setInputText(''); // 立即清空输入框，提升体验

    // 构造写入数据库的数据对象
    const messageData = {
      content: textToSend,
      sender_id: CURRENT_USER_ID,
      type: MessageType.TEXT,
      self_destruct: isBurning,
      // 如果开启阅后即焚，写入当前时间 + 5分钟
      destruct_at: isBurning ? Date.now() + 5 * 60 * 1000 : null
    };

    // 发送到 MemFire
    const { error } = await supabase.from('messages').insert(messageData);

    if (error) {
      console.error('发送失败:', error);
      alert('发送失败，请重试');
      setInputText(textToSend); // 失败则恢复文字
    }
  };

  // 图片/视频 上传逻辑
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, type: MessageType) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const content = event.target?.result as string;
      
      const messageData = {
        content: content, // 这里直接存 Base64，简单粗暴
        sender_id: CURRENT_USER_ID,
        type: type,
        self_destruct: isBurning,
        destruct_at: isBurning ? Date.now() + 5 * 60 * 1000 : null
      };

      await supabase.from('messages').insert(messageData);
    };
    reader.readAsDataURL(file);
  };

  // ----------------------------------------------------
  // UI 渲染部分 (保持你原有的样式完全不变)
  // ----------------------------------------------------
  return (
    <div className="flex flex-col h-full bg-[#F2F2F7]">
      {/* Messages Area */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar pb-24"
      >
        <div className="text-center text-xs text-gray-400 my-4">加密连接已建立</div>
        
        {messages.map((msg) => (
          <div 
            key={msg.id} 
            className={`flex flex-col ${msg.senderId === 'me' ? 'items-end' : 'items-start'}`}
          >
            <div className={`flex items-end gap-1 ${msg.senderId === 'me' ? 'flex-row-reverse' : 'flex-row'}`}>
              <div 
                className={`max-w-[75%] p-3 rounded-2xl text-sm shadow-sm 
                  ${msg.senderId === 'me' 
                    ? 'bg-pink-500 text-white rounded-br-none' 
                    : 'bg-white text-black rounded-bl-none'
                }`}
              >
                {msg.type === MessageType.TEXT && msg.content}
                {msg.type === MessageType.IMAGE && (
                  <img src={msg.content} alt="Upload" className="rounded-lg max-h-60 object-cover" />
                )}
                {msg.type === MessageType.VIDEO && (
                  <video src={msg.content} controls className="rounded-lg max-h-60" />
                )}
                
                {msg.selfDestruct && (
                  <div className="mt-2 pt-2 border-t border-white/20 flex items-center gap-1 text-[10px] opacity-80">
                    <Flame size={12} />
                    <span>{msg.destructAt ?
                      Math.max(0, Math.ceil((msg.destructAt - Date.now()) / 1000 / 60)) : 5}分钟后销毁</span>
                  </div>
                )}
              </div>
              
              {msg.senderId === 'me' && (
                <div className="mb-1">
                  {/* 注意：为了简化，这里只要发出去就显示蓝色对勾，不真正判断对方是否已读 */}
                  <CheckCheck size={14} className={'text-blue-500'} />
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Input Area */}
      <div className="fixed bottom-[84px] left-0 right-0 ios-blur border-t p-3 safe-pb">
        <div className="flex items-center gap-2 mb-2">
            <button 
                onClick={() => setIsBurning(!isBurning)}
                className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs transition-all ${
                  isBurning ? 'bg-orange-500 text-white shadow-inner' : 'bg-gray-100 text-gray-500'
                }`}
            >
                <Flame size={14} />
                阅后五分钟即焚
            </button>
        </div>
         
        <div className="flex items-end gap-2">
          <div className="flex gap-2 mb-1">
            <label className="cursor-pointer text-gray-400 active:text-pink-500 transition-colors">
                <ImageIcon size={24} />
                <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFileUpload(e, MessageType.IMAGE)} />
            </label>
            <label className="cursor-pointer text-gray-400 active:text-pink-500 transition-colors">
                <Video size={24} />
                <input type="file" accept="video/*" className="hidden" onChange={(e) => handleFileUpload(e, MessageType.VIDEO)} />
            </label>
          </div>
          
          <div className="flex-1 bg-white border rounded-2xl min-h-[38px] flex items-center px-3 py-1">
            <textarea 
              rows={1}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="发送消息..."
              className="flex-1 outline-none text-sm resize-none bg-transparent"
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSend())}
            />
            <Smile size={20} className="text-gray-400 ml-2" />
          </div>

          <button 
            onClick={handleSend}
            disabled={!inputText.trim()}
            className="w-10 h-10 bg-pink-500 rounded-full flex items-center justify-center text-white disabled:bg-gray-300 shadow-md active:scale-95 transition-all"
          >
            <Send size={18} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatPage;
