
import React, { useState, useEffect } from 'react';
import { Lock, Delete, ArrowRight } from 'lucide-react';
import { storage } from '../services/storageService';
import { STORAGE_KEYS } from '../constants';

interface PasscodeLockProps {
  onSuccess: () => void;
}

const PasscodeLock: React.FC<PasscodeLockProps> = ({ onSuccess }) => {
  const [passcode, setPasscode] = useState<string>('');
  const [savedPasscode, setSavedPasscode] = useState<string | null>(null);
  const [mode, setMode] = useState<'login' | 'setup' | 'verify'>('login');
  const [error, setError] = useState<string>('');

  useEffect(() => {
    const stored = storage.get<string | null>(STORAGE_KEYS.PASSCODE, null);
    if (!stored) {
      setMode('setup');
    } else {
      setSavedPasscode(stored);
      setMode('login');
    }
  }, []);

  const handleInput = (char: string) => {
    if (passcode.length < 12) {
      setPasscode(prev => prev + char);
      setError('');
    }
  };

  const handleBackspace = () => {
    setPasscode(prev => prev.slice(0, -1));
  };

  const handleSubmit = () => {
    if (mode === 'login') {
      if (passcode === savedPasscode) {
        onSuccess();
      } else {
        setError('密码错误，请重试');
        setPasscode('');
      }
    } else if (mode === 'setup') {
      if (passcode.length >= 4) {
        storage.set(STORAGE_KEYS.PASSCODE, passcode);
        onSuccess();
      } else {
        setError('密码长度至少4位');
      }
    }
  };

  const renderKeypad = () => {
    const rows = [
      ['1', '2', '3'],
      ['4', '5', '6'],
      ['7', '8', '9'],
      ['A', '0', 'B']
    ];

    return (
      <div className="grid grid-cols-3 gap-6 mt-12 w-full max-w-xs mx-auto">
        {rows.flat().map((key) => (
          <button
            key={key}
            onClick={() => handleInput(key)}
            className="w-16 h-16 rounded-full ios-blur flex items-center justify-center text-2xl font-medium active:bg-gray-300 transition-colors"
          >
            {key}
          </button>
        ))}
        <div />
        <button
          onClick={handleBackspace}
          className="w-16 h-16 rounded-full flex items-center justify-center text-gray-500 active:text-black"
        >
          <Delete size={24} />
        </button>
        <button
          onClick={handleSubmit}
          className="w-16 h-16 rounded-full bg-pink-500 text-white flex items-center justify-center active:bg-pink-600 shadow-lg"
        >
          <ArrowRight size={28} />
        </button>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-[100] bg-white safe-pt flex flex-col items-center justify-center px-8 text-center">
      <div className="mb-8 p-6 bg-pink-50 rounded-full">
        <Lock size={48} className="text-pink-500" />
      </div>
      
      <h1 className="text-2xl font-bold mb-2">
        {mode === 'login' ? '输入访问密码' : '设置私密密码'}
      </h1>
      <p className="text-gray-500 mb-8">
        {mode === 'login' ? '只有我们可以进入的空间' : '设置一个仅属于我们的数字字母组合密码'}
      </p>

      <div className="flex gap-3 justify-center mb-4 min-h-[40px]">
        {Array.from({ length: Math.max(passcode.length, 4) }).map((_, i) => (
          <div
            key={i}
            className={`w-4 h-4 rounded-full border-2 border-pink-500 transition-all ${
              i < passcode.length ? 'bg-pink-500 scale-110' : 'bg-transparent'
            }`}
          />
        ))}
      </div>

      {error && <p className="text-red-500 text-sm animate__animated animate__shakeX">{error}</p>}

      {renderKeypad()}

      <div className="mt-12">
        <button className="text-pink-500 font-medium text-sm">忘记密码？通过私密问题找回</button>
      </div>
    </div>
  );
};

export default PasscodeLock;
