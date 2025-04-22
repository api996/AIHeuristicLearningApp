import { useState, useEffect } from 'react';

interface DeviceInfo {
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  isIOS: boolean;
  isAndroid: boolean;
}

/**
 * 设备检测钩子
 * 用于检测用户当前设备类型，方便应用不同的交互模式和优化策略
 */
export function useDeviceDetect(): DeviceInfo {
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo>({
    isMobile: false,
    isTablet: false,
    isDesktop: true,
    isIOS: false,
    isAndroid: false
  });

  useEffect(() => {
    // 检测设备类型的函数
    const detectDevice = () => {
      const ua = navigator.userAgent;
      
      // 检测移动设备
      const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
      
      // 更详细地检测平板设备 (简单实现，实际使用可能需要更复杂的逻辑)
      const isTabletDevice = 
        /(iPad|Android(?!.*Mobile)|tablet|Tablet)/i.test(ua) || 
        (isMobileDevice && Math.min(window.innerWidth, window.innerHeight) > 480);
      
      // iOS 设备检测
      const isIOSDevice = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
      
      // Android 设备检测
      const isAndroidDevice = /Android/i.test(ua);
      
      // 设置设备信息
      setDeviceInfo({
        isMobile: isMobileDevice && !isTabletDevice,
        isTablet: isTabletDevice,
        isDesktop: !isMobileDevice && !isTabletDevice,
        isIOS: isIOSDevice,
        isAndroid: isAndroidDevice
      });
      
      // 在控制台记录检测到的设备信息
      if (isIOSDevice) {
        console.log("检测到iPhone设备，应用移动布局优化");
      } else if (isAndroidDevice) {
        console.log("检测到Android设备，应用移动布局优化");
      } else if (isTabletDevice) {
        console.log("检测到平板设备，应用平板布局优化");
      } else {
        console.log("检测到桌面设备，应用标准布局");
      }
    };

    // 初始检测
    detectDevice();
    
    // 监听窗口尺寸变化，重新检测设备类型
    const handleResize = () => {
      detectDevice();
    };
    
    window.addEventListener('resize', handleResize);
    
    // 清理函数
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return deviceInfo;
}