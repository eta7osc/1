
import React, { useState, useEffect } from 'react';
import { Camera, Heart, MessageSquare, Share } from 'lucide-react';
import { Moment } from '../types';
import { storage } from '../services/storageService';
import { STORAGE_KEYS } from '../constants';

const MomentsPage: React.FC = () => {
  const [moments, setMoments] = useState<Moment[]>([]);
  const [showPublish, setShowPublish] = useState(false);
  const [newContent, setNewContent] = useState('');
  const [newImages, setNewImages] = useState<string[]>([]);

  useEffect(() => {
    const saved = storage.get<Moment[]>(STORAGE_KEYS.MOMENTS, [
      {
        id: 'm1',
        author: '男友',
        content: '今天一起去看的落日好美呀~ ☀️',
        media: ['https://picsum.photos/seed/sunset/800/600'],
        type: 'image',
        timestamp: Date.now() - 3600000,
        likes: ['女友'],
        comments: []
      }
    ]);
    setMoments(saved);
  }, []);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      setNewImages([...newImages, event.target?.result as string]);
    };
    reader.readAsDataURL(file);
  };

  const handlePublish = () => {
    if (!newContent && newImages.length === 0) return;
    const m: Moment = {
      id: Date.now().toString(),
      author: '我',
      content: newContent,
      media: newImages,
      type: 'image',
      timestamp: Date.now(),
      likes: [],
      comments: []
    };
    const updated = [m, ...moments];
    setMoments(updated);
    storage.set(STORAGE_KEYS.MOMENTS, updated);
    setNewContent('');
    setNewImages([]);
    setShowPublish(false);
  };

  return (
    <div className="bg-white min-h-full pb-28 overflow-y-auto no-scrollbar">
      {/* Header Banner */}
      <div className="relative h-64 bg-gray-200">
        <img src="https://picsum.photos/seed/love/1200/800" alt="Cover" className="w-full h-full object-cover" />
        <div className="absolute -bottom-8 right-4 flex flex-col items-end">
          <div className="flex items-center gap-3">
            <span className="text-white font-bold text-lg drop-shadow-md mb-2">我们的秘密花园</span>
            <div className="w-16 h-16 rounded-2xl border-4 border-white bg-white overflow-hidden shadow-lg">
                <img src="https://picsum.photos/seed/avatar/200/200" alt="Avatar" />
            </div>
          </div>
        </div>
        <button 
          onClick={() => setShowPublish(true)}
          className="absolute top-12 right-4 w-10 h-10 ios-blur-dark rounded-full flex items-center justify-center text-white"
        >
          <Camera size={20} />
        </button>
      </div>

      <div className="mt-16 px-4 space-y-12">
        {moments.map((m) => (
          <div key={m.id} className="flex gap-3">
            <div className="w-12 h-12 rounded-xl bg-gray-100 flex-shrink-0 overflow-hidden">
                <img src={`https://picsum.photos/seed/${m.author}/200/200`} alt="Avatar" />
            </div>
            <div className="flex-1 space-y-3">
              <h4 className="font-bold text-blue-900 text-sm">{m.author}</h4>
              <p className="text-sm leading-relaxed text-gray-800">{m.content}</p>
              
              <div className={`grid ${m.media.length > 1 ? 'grid-cols-2' : 'grid-cols-1'} gap-1 rounded-xl overflow-hidden`}>
                {m.media.map((img, i) => (
                  <img key={i} src={img} alt="Post" className="w-full h-48 object-cover active:opacity-80 transition-opacity" />
                ))}
              </div>

              <div className="flex justify-between items-center text-gray-400 pt-1">
                <span className="text-xs">{new Date(m.timestamp).toLocaleString()}</span>
                <div className="flex gap-4">
                  <Heart size={18} className={m.likes.length > 0 ? 'text-pink-500 fill-pink-500' : ''} />
                  <MessageSquare size={18} />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {showPublish && (
        <div className="fixed inset-0 z-50 bg-white flex flex-col safe-pt animate__animated animate__fadeInRight">
          <div className="flex justify-between items-center p-4 border-b">
            <button onClick={() => setShowPublish(false)} className="text-gray-500">取消</button>
            <button onClick={handlePublish} className="bg-green-500 text-white px-4 py-1.5 rounded-lg text-sm font-bold">发表</button>
          </div>
          <div className="p-4 space-y-6">
            <textarea 
              autoFocus
              className="w-full h-32 text-lg outline-none resize-none"
              placeholder="这一刻的想法..."
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
            />
            <div className="grid grid-cols-4 gap-2">
              {newImages.map((img, i) => (
                <div key={i} className="relative aspect-square">
                    <img src={img} className="w-full h-full object-cover rounded-lg" />
                </div>
              ))}
              <label className="aspect-square bg-gray-100 rounded-lg flex items-center justify-center text-gray-400 cursor-pointer">
                <Plus size={32} />
                <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
              </label>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const Plus: React.FC<{size: number}> = ({size}) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
);

export default MomentsPage;
