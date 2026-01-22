
import React, { useState } from 'react';
import { Grid, Image as ImageIcon, Download, Maximize2 } from 'lucide-react';

const PhotoWallPage: React.FC = () => {
  const albums = ['全部照片', '旅行回忆', '搞怪时刻', '浪漫日常'];
  const [activeTab, setActiveTab] = useState(0);

  const mockPhotos = Array.from({ length: 20 }).map((_, i) => ({
    id: i,
    url: `https://picsum.photos/seed/photo${i}/600/600`,
    category: albums[i % 4]
  }));

  return (
    <div className="bg-[#F2F2F7] min-h-full pb-28">
      <div className="bg-white p-4 safe-pt border-b sticky top-0 z-10">
        <h2 className="text-2xl font-bold mb-4">相册墙</h2>
        <div className="flex gap-4 overflow-x-auto no-scrollbar">
          {albums.map((album, i) => (
            <button
              key={i}
              onClick={() => setActiveTab(i)}
              className={`whitespace-nowrap px-4 py-2 rounded-full text-sm font-medium transition-all ${
                activeTab === i ? 'bg-pink-500 text-white shadow-md' : 'bg-gray-100 text-gray-500'
              }`}
            >
              {album}
            </button>
          ))}
        </div>
      </div>

      <div className="p-2 grid grid-cols-3 gap-1">
        {mockPhotos.map((photo) => (
          <div key={photo.id} className="relative aspect-square group overflow-hidden bg-gray-200">
            <img 
              src={photo.url} 
              loading="lazy"
              className="w-full h-full object-cover active:scale-110 transition-transform duration-300" 
              alt="Moment" 
            />
            <div className="absolute inset-0 bg-black/20 opacity-0 group-active:opacity-100 flex items-center justify-center transition-opacity">
                <Maximize2 size={24} className="text-white" />
            </div>
          </div>
        ))}
      </div>
      
      <div className="fixed bottom-[100px] right-6">
        <button className="w-14 h-14 bg-pink-500 rounded-full shadow-2xl flex items-center justify-center text-white active:scale-90 transition-transform">
          <ImageIcon size={28} />
        </button>
      </div>
    </div>
  );
};

export default PhotoWallPage;
