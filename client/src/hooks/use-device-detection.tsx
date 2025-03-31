import { useState, useEffect } from 'react';
import { useDeviceInfo, DeviceType, useIPhoneModel } from './use-mobile';
import { apiRequest } from '../lib/queryClient';

// 设备信息上报接口
interface DeviceReportProps {
  userId?: number;
  onSuccess?: (info: any) => void;
  onError?: (error: Error) => void;
}

/**
 * 向服务器报告设备信息的钩子
 */
export function useDeviceReport({ userId, onSuccess, onError }: DeviceReportProps = {}) {
  const deviceInfo = useDeviceInfo();
  const iphoneModel = useIPhoneModel();
  const [reportStatus, setReportStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [error, setError] = useState<Error | null>(null);
  
  // 默认使用iPhone 15 Pro Max的设备信息
  const effectiveDeviceInfo = useMemo(() => {
    // 如果设备信息无法获取或不完整，使用默认值
    if (!deviceInfo || deviceInfo.width <= 0) {
      return {
        ...deviceInfo,
        isMobile: true,
        isTablet: false,
        isDesktop: false,
        deviceType: DeviceType.MOBILE,
        width: 430, // iPhone 15 Pro Max 宽度
        height: 932, // iPhone 15 Pro Max 高度
        isIOS: true,
        isAndroid: false,
        isPortrait: true,
        isLandscape: false,
        userAgent: 'iPhone'
      };
    }
    return deviceInfo;
  }, [deviceInfo]);
  
  // 强制使用iPhone 15 Pro Max作为机型
  const effectiveIphoneModel = 'iphone-pro-max';
  
  // 当设备信息加载完成后，发送到服务器
  useEffect(() => {
    // 使用默认值或检测到的设备信息
    if (reportStatus === 'idle') {
      setReportStatus('loading');
      
      const reportDevice = async () => {
        try {
          const response = await apiRequest('POST', '/api/device-info', {
            userAgent: effectiveDeviceInfo.userAgent,
            screenWidth: effectiveDeviceInfo.width,
            screenHeight: effectiveDeviceInfo.height,
            deviceType: effectiveDeviceInfo.deviceType,
            isIOS: effectiveDeviceInfo.isIOS,
            isAndroid: effectiveDeviceInfo.isAndroid,
            iphoneModel: effectiveIphoneModel,
            userId: userId
          });
          
          const data = await response.json();
          setReportStatus('success');
          
          if (onSuccess) {
            onSuccess(data);
          }
          
          return data;
        } catch (err) {
          console.error('设备信息上报失败:', err);
          setError(err instanceof Error ? err : new Error('设备信息上报失败'));
          setReportStatus('error');
          
          if (onError) {
            onError(err instanceof Error ? err : new Error('设备信息上报失败'));
          }
        }
      };
      
      reportDevice();
    }
  }, [deviceInfo, iphoneModel, userId, reportStatus, onSuccess, onError]);
  
  return { 
    deviceInfo: effectiveDeviceInfo, 
    iphoneModel: effectiveIphoneModel, 
    reportStatus, 
    error 
  };
}

/**
 * 为iPhone设备提供特殊CSS类的钩子
 */
export function useIPhoneCSSClasses() {
  const { isIOS } = useDeviceInfo();
  const iphoneModel = useIPhoneModel();
  const [cssClasses, setCssClasses] = useState<string>('');
  
  useEffect(() => {
    // 清理之前的所有设备相关类
    document.documentElement.classList.remove(
      'iphone', 'iphone-small', 'iphone-x', 'iphone-xr', 
      'iphone-12', 'iphone-pro-max', 'iphone-modern',
      'android', 'mobile-device'
    );
    
    // 为所有移动设备添加通用移动设备类
    if (deviceInfo.isMobile || deviceInfo.isTablet) {
      document.documentElement.classList.add('mobile-device');
    }
    
    if (!isIOS && !deviceInfo.isAndroid) {
      setCssClasses('');
      return;
    }
    
    let classes = '';
    
    // iOS 设备处理
    if (isIOS) {
      classes = 'iphone ';
      
      switch(iphoneModel) {
        case 'iphone-8-or-smaller':
          classes += 'iphone-small';
          break;
        case 'iphone-x-xs-11pro':
          classes += 'iphone-x';
          break;
        case 'iphone-xr-xs-max-11':
          classes += 'iphone-xr';
          break;
        case 'iphone-12-13-14':
          classes += 'iphone-12';
          break;
        case 'iphone-pro-max':
          classes += 'iphone-pro-max';
          break;
        default:
          classes += 'iphone-modern';
      }
    } 
    // Android 设备处理
    else if (deviceInfo.isAndroid) {
      classes = 'android';
    }
    
    setCssClasses(classes);
    
    // 添加设备类到根元素
    const classesToAdd = classes.split(' ').filter(c => c);
    classesToAdd.forEach(cls => {
      document.documentElement.classList.add(cls);
    });
    
    return () => {
      // 清理添加的类
      classesToAdd.forEach(cls => {
        document.documentElement.classList.remove(cls);
      });
    };
  }, [isIOS, deviceInfo.isAndroid, deviceInfo.isMobile, deviceInfo.isTablet, iphoneModel]);
  
  return cssClasses;
}

/**
 * 动态调整iPhone上的安全区域
 */
export function useIPhoneSafeAreas() {
  const { isIOS } = useDeviceInfo();
  const iphoneModel = useIPhoneModel();
  
  useEffect(() => {
    if (!isIOS) return;
    
    // 设置CSS变量
    const setCSSVariable = (name: string, value: string) => {
      document.documentElement.style.setProperty(name, value);
    };
    
    // 根据不同iPhone型号设置安全区域
    if (iphoneModel.includes('iphone-x') || 
        iphoneModel.includes('iphone-11') || 
        iphoneModel.includes('iphone-12') || 
        iphoneModel.includes('iphone-pro-max')) {
      
      // 有刘海的iPhone
      setCSSVariable('--safe-area-top', '47px');
      setCSSVariable('--safe-area-bottom', '34px');
    } else {
      // 没有刘海的iPhone
      setCSSVariable('--safe-area-top', '20px');
      setCSSVariable('--safe-area-bottom', '20px');
    }
    
    // 横竖屏检测
    const handleOrientationChange = () => {
      const isLandscape = window.innerWidth > window.innerHeight;
      if (isLandscape) {
        setCSSVariable('--safe-area-left', '20px');
        setCSSVariable('--safe-area-right', '20px');
      } else {
        setCSSVariable('--safe-area-left', '0px');
        setCSSVariable('--safe-area-right', '0px');
      }
    };
    
    // 初始化和监听方向变化
    handleOrientationChange();
    window.addEventListener('orientationchange', handleOrientationChange);
    window.addEventListener('resize', handleOrientationChange);
    
    return () => {
      window.removeEventListener('orientationchange', handleOrientationChange);
      window.removeEventListener('resize', handleOrientationChange);
    };
  }, [isIOS, iphoneModel]);
}