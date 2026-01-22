
import React, { useState, useEffect } from 'react';
import { Calendar, Plus, Bell, Trash2 } from 'lucide-react';
import { Anniversary } from '../types';
import { storage } from '../services/storageService';
import { STORAGE_KEYS } from '../constants';

const AnniversaryPage: React.FC = () => {
  const [anniversaries, setAnniversaries] = useState<Anniversary[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDate, setNewDate] = useState('');

  useEffect(() => {
    const saved = storage.get<Anniversary[]>(STORAGE_KEYS.ANNIVERSARIES, [
      { id: '1', title: '恋爱开始的那天', date: '2023-01-01', reminderDays: 1 }
    ]);
    setAnniversaries(saved);
  }, []);

  const saveAnniversaries = (data: Anniversary[]) => {
    setAnniversaries(data);
    storage.set(STORAGE_KEYS.ANNIVERSARIES, data);
  };

  const handleAdd = () => {
    if (!newTitle || !newDate) return;
    const item: Anniversary = {
      id: Date.now().toString(),
      title: newTitle,
      date: newDate,
      reminderDays: 1
    };
    saveAnniversaries([...anniversaries, item]);
    setNewTitle('');
    setNewDate('');
    setShowAdd(false);
  };

  const calculateDays = (dateStr: string) => {
    const target = new Date(dateStr);
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const diff = target.getTime() - now.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  return (
    <div className="p-4 space-y-6 bg-[#F2F2F7] min-h-full pb-28 overflow-y-auto">
      <div className="flex justify-between items-center px-2">
        <h2 className="text-3xl font-bold">纪念日</h2>
        <button 
            onClick={() => setShowAdd(true)}
            className="w-8 h-8 bg-pink-500 rounded-full flex items-center justify-center text-white shadow-lg active:scale-90 transition-transform"
        >
          <Plus size={20} />
        </button>
      </div>

      <div className="space-y-4">
        {anniversaries.map((ann) => {
          const days = calculateDays(ann.date);
          return (
            <div key={ann.id} className="bg-white rounded-2xl p-4 shadow-sm flex items-center justify-between group">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-pink-50 rounded-2xl flex items-center justify-center text-pink-500">
                  <Calendar size={24} />
                </div>
                <div>
                  <h3 className="font-bold text-gray-800">{ann.title}</h3>
                  <p className="text-xs text-gray-400">{ann.date}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-2xl font-black text-pink-500">
                    {days > 0 ? `还剩 ${days}` : days === 0 ? '就是今天！' : `已过 ${Math.abs(days)}`}
                </p>
                <p className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">Days</p>
              </div>
            </div>
          );
        })}
      </div>

      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white w-full rounded-3xl p-6 shadow-2xl animate__animated animate__slideInUp">
            <h3 className="text-xl font-bold mb-4">新增纪念日</h3>
            <div className="space-y-4">
              <input 
                type="text" 
                placeholder="名称 (例: 我的生日)" 
                className="w-full bg-gray-100 p-4 rounded-xl outline-none"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
              />
              <input 
                type="date" 
                className="w-full bg-gray-100 p-4 rounded-xl outline-none"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
              />
              <div className="flex gap-3 pt-4">
                <button 
                  onClick={() => setShowAdd(false)}
                  className="flex-1 py-4 text-gray-500 font-bold active:bg-gray-50 rounded-xl"
                >
                  取消
                </button>
                <button 
                  onClick={handleAdd}
                  className="flex-1 py-4 bg-pink-500 text-white font-bold rounded-xl shadow-lg shadow-pink-200"
                >
                  保存
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AnniversaryPage;
