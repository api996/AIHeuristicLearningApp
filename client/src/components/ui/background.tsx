
import React, { useState, useEffect } from 'react';

interface BackgroundProps {
  customImage?: string;
  children?: React.ReactNode;
}

export const Background: React.FC<BackgroundProps> = ({ customImage, children }) => {
  const [bgImage, setBgImage] = useState<string | null>(null);
  
  useEffect(() => {
    // 如果提供了自定义图片，使用它
    if (customImage) {
      setBgImage(customImage);
      return;
    }
    
    // 否则尝试从本地存储加载
    const savedBg = localStorage.getItem('background-image');
    if (savedBg) {
      setBgImage(savedBg);
    }
  }, [customImage]);

  return (
    <>
      <div className="bg-container">
        {bgImage ? (
          <img 
            src={bgImage} 
            alt="Background" 
            className="bg-image" 
          />
        ) : (
          // 默认背景 - 纯色或渐变
          <div className="bg-default" />
        )}
      </div>
      {children}
    </>
  );
};

export default Background;
