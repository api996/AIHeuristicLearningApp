
import React, { useState, useEffect } from 'react';

interface BackgroundProps {
  customImage?: string;
  children?: React.ReactNode;
  className?: string;
}

export const Background: React.FC<BackgroundProps> = ({ 
  customImage, 
  children,
  className = '' 
}) => {
  const [bgImage, setBgImage] = useState<string | null>(null);
  
  useEffect(() => {
    // 如果提供了自定义图片，使用它
    if (customImage) {
      setBgImage(customImage);
      return;
    }
    
    // 尝试从本地存储加载背景
    const savedBg = localStorage.getItem('background-image');
    if (savedBg) {
      setBgImage(savedBg);
    }
  }, [customImage]);

  return (
    <div className={`relative w-full h-full ${className}`}>
      <div className="fixed inset-0 w-full h-full -z-10 overflow-hidden">
        {bgImage ? (
          <img 
            src={bgImage} 
            alt="Background" 
            className="w-full h-full object-cover"
            style={{
              filter: 'none',
              backdropFilter: 'none',
              WebkitBackdropFilter: 'none'
            }}
          />
        ) : (
          <div className="bg-default w-full h-full" />
        )}
      </div>
      {children}
    </div>
  );
};

export default Background;
