
import React, { ReactNode, useEffect } from 'react';
import { useDeviceInfo } from '../../hooks/use-mobile';
import { useIPhoneSafeAreas, useIPhoneCSSClasses } from '../../hooks/use-device-detection';

interface MobileContainerProps {
  children: ReactNode;
  className?: string;
}

export function MobileContainer({ children, className = '' }: MobileContainerProps) {
  const deviceInfo = useDeviceInfo();
  
  // 启用 iPhone 安全区域
  useIPhoneSafeAreas();
  
  // 应用iPhone CSS类
  const cssClasses = useIPhoneCSSClasses();
  
  return (
    <div 
      className={`app-container ${
        deviceInfo.isMobile ? 'mobile-view' : ''
      } ${
        deviceInfo.isIOS ? 'ios-device safe-area-top safe-area-bottom' : ''
      } ${
        deviceInfo.isAndroid ? 'android-device' : ''
      } ${cssClasses} ${className}`}
    >
      {children}
    </div>
  );
}

// 用于包装滚动内容的容器
export function MobileScrollContainer({ children, className = '' }: MobileContainerProps) {
  const { isMobile, isIOS } = useDeviceInfo();
  
  return (
    <div 
      className={`content-scrollbar ${
        isMobile ? 'mobile-scroll p-2' : 'p-4'
      } ${
        isIOS ? 'ios-scroll' : ''
      } ${className}`}
    >
      {children}
    </div>
  );
}

// 头部导航栏容器，处理不同设备的样式
export function MobileNavbar({ children, className = '' }: MobileContainerProps) {
  const { isMobile, isIOS } = useDeviceInfo();
  
  return (
    <header 
      className={`${
        isMobile ? 'navbar-mobile py-2 px-3' : 'py-4 px-6'
      } ${
        isIOS ? 'safe-area-top' : ''
      } ${className}`}
    >
      {children}
    </header>
  );
}

// 底部导航栏或工具栏容器
export function MobileFooter({ children, className = '' }: MobileContainerProps) {
  const { isMobile, isIOS } = useDeviceInfo();
  
  return (
    <footer 
      className={`${
        isMobile ? 'footer-mobile py-2 px-3' : 'py-3 px-6'
      } ${
        isIOS ? 'safe-area-bottom' : ''
      } ${className}`}
    >
      {children}
    </footer>
  );
}

// 适用于固定在底部的内容容器
export function MobileFixedBottom({ children, className = '' }: MobileContainerProps) {
  const { isIOS } = useDeviceInfo();
  
  return (
    <div 
      className={`fixed bottom-0 left-0 right-0 ${
        isIOS ? 'safe-area-bottom' : 'pb-4'
      } ${className}`}
    >
      {children}
    </div>
  );
}
