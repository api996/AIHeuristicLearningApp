
import React, { ReactNode } from 'react';
import { useDeviceInfo } from '../../hooks/use-mobile';
import { useIPhoneSafeAreas } from '../../hooks/use-device-detection';

interface MobileContainerProps {
  children: ReactNode;
  className?: string;
}

export function MobileContainer({ children, className = '' }: MobileContainerProps) {
  const deviceInfo = useDeviceInfo();
  
  // 启用 iPhone 安全区域
  useIPhoneSafeAreas();
  
  return (
    <div 
      className={`app-container ${
        deviceInfo.isMobile ? 'mobile-view' : ''
      } ${
        deviceInfo.isIOS ? 'ios-device safe-area-top safe-area-bottom' : ''
      } ${
        deviceInfo.isAndroid ? 'android-device' : ''
      } ${className}`}
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
  const { isMobile } = useDeviceInfo();
  
  return (
    <header 
      className={`${
        isMobile ? 'navbar-mobile py-2 px-3' : 'py-4 px-6'
      } ${className}`}
    >
      {children}
    </header>
  );
}

// 对话框容器，确保在移动设备上正确显示
export function MobileDialog({ children, className = '' }: MobileContainerProps) {
  const { isMobile } = useDeviceInfo();
  
  return (
    <div 
      className={`dialog-content ${
        isMobile ? 'mobile-dialog max-w-[90vw]' : ''
      } ${className}`}
    >
      {children}
    </div>
  );
}
