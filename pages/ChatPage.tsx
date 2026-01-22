
import React, { useState, useEffect, useRef } from 'react';
import { Send, Image as ImageIcon, Video, Smile, Flame, Clock, CheckCheck } from 'lucide-react';
import { Message, MessageType } from '../types';
import { storage } from '../services/storageService';
import { STORAGE_KEYS } from '../constants';

const ChatPage: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isBurning, setIsBurning] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const saved = storage.get<Message[]>(STORAGE_KEYS.MESSAGES, []);
    setMessages(saved);
  }, []);

  useEffect(() => {
    storage.set(STORAGE_KEYS.MESSAGES, messages);
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Handle self-destruct timers
  useEffect(() => {
    const timer = setInterval(() => {
      const now = Date.now();
      setMessages(prev => {
        const filtered = prev.filter(m => !m.destructAt || m.destructAt > now);
        if (filtered.length !== prev.length) {
          return filtered;
        }
        return prev;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleSend = () => {
    if (!inputText.trim()) return;

    const newMessage: Message = {
      id: Math.random().toString(36).substr(2, 9),
      senderId: 'me',
      content: inputText,
      type: MessageType.TEXT,
      timestamp: Date.now(),
      isRead: false,
      selfDestruct: isBurning,
      destructAt: isBurning ? Date.now() + 5 * 60 * 1000 : undefined // 5 minutes
    };

    setMessages([...messages, newMessage]);
    setInputText('');
    
    // Simulate auto-read and partner response for demo
    setTimeout(() => {
        setMessages(prev => prev.map(m => m.id === newMessage.id ? { ...m, isRead: true } : m));
    }, 2000);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, type: MessageType) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const newMessage: Message = {
        id: Math.random().toString(36).substr(2, 9),
        senderId: 'me',
        content,
        type,
        timestamp: Date.now(),
        isRead: false
      };
      setMessages([...messages, newMessage]);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="flex flex-col h-full bg-[#F2F2F7]">
      {/* Messages Area */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar pb-24"
      >
        <div className="text-center text-xs text-gray-400 my-4">今天 12:00</div>
        
        {messages.map((msg) => (
          <div 
            key={msg.id} 
            className={`flex flex-col ${msg.senderId === 'me' ? 'items-end' : 'items-start'}`}
          >
            <div className={`flex items-end gap-1 ${msg.senderId === 'me' ? 'flex-row-reverse' : 'flex-row'}`}>
              <div 
                className={`max-w-[75%] p-3 rounded-2xl text-sm shadow-sm ${
                  msg.senderId === 'me' 
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
                    <span>{msg.destructAt ? Math.ceil((msg.destructAt - Date.now()) / 1000 / 60) : 5}分钟后销毁</span>
                  </div>
                )}
              </div>
              
              {msg.senderId === 'me' && (
                <div className="mb-1">
                  <CheckCheck size={14} className={msg.isRead ? 'text-blue-500' : 'text-gray-300'} />
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
