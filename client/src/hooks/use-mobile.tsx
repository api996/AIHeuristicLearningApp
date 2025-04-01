import * as React from "react"

const MOBILE_BREAKPOINT = 768
const TABLET_BREAKPOINT = 1024

// 设备类型枚举
export enum DeviceType {
  MOBILE = 'mobile',
  TABLET = 'tablet',
  DESKTOP = 'desktop',
  UNKNOWN = 'unknown'
}

// 设备信息接口
export interface DeviceInfo {
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  deviceType: DeviceType;
  width: number;
  height: number;
  isIOS: boolean;
  isAndroid: boolean;
  isPortrait: boolean;
  isLandscape: boolean;
  userAgent: string;
}

// 基础的 isMobile hook
export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined)

  React.useEffect(() => {
    // 使用更可靠的检测方法
    const checkIsMobile = () => {
      return window.innerWidth < MOBILE_BREAKPOINT || 
        /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    };
    
    const onChange = () => {
      setIsMobile(checkIsMobile());
    };
    
    // 添加多种事件监听以确保检测准确性
    window.addEventListener("resize", onChange);
    window.addEventListener("orientationchange", onChange);
    
    // 初始设置
    setIsMobile(checkIsMobile());
    
    return () => {
      window.removeEventListener("resize", onChange);
      window.removeEventListener("orientationchange", onChange);
    };
  }, []);

  return !!isMobile
}

// 增强的设备信息 hook
export function useDeviceInfo(): DeviceInfo {
  const [deviceInfo, setDeviceInfo] = React.useState<DeviceInfo>({
    isMobile: false,
    isTablet: false,
    isDesktop: false,
    deviceType: DeviceType.UNKNOWN,
    width: 0,
    height: 0,
    isIOS: false,
    isAndroid: false,
    isPortrait: false,
    isLandscape: false,
    userAgent: ''
  })

  React.useEffect(() => {
    const updateDeviceInfo = () => {
      const width = window.innerWidth
      const height = window.innerHeight
      const userAgent = navigator.userAgent
      const isIOS = /iPhone|iPad|iPod/i.test(userAgent)
      const isAndroid = /Android/i.test(userAgent)
      const isPortrait = height > width
      const isLandscape = width > height
      
      // 判断设备类型
      let deviceType = DeviceType.UNKNOWN
      let isMobile = false
      let isTablet = false
      let isDesktop = false
      
      if (width < MOBILE_BREAKPOINT || /iPhone|Android.*Mobile/i.test(userAgent)) {
        deviceType = DeviceType.MOBILE
        isMobile = true
      } else if (width < TABLET_BREAKPOINT || /iPad/i.test(userAgent)) {
        deviceType = DeviceType.TABLET
        isTablet = true
      } else {
        deviceType = DeviceType.DESKTOP
        isDesktop = true
      }
      
      setDeviceInfo({
        isMobile,
        isTablet,
        isDesktop,
        deviceType,
        width,
        height,
        isIOS,
        isAndroid,
        isPortrait,
        isLandscape,
        userAgent
      })
    }
    
    // 初始化
    updateDeviceInfo()
    
    // 监听尺寸变化
    window.addEventListener('resize', updateDeviceInfo)
    window.addEventListener('orientationchange', updateDeviceInfo)
    
    return () => {
      window.removeEventListener('resize', updateDeviceInfo)
      window.removeEventListener('orientationchange', updateDeviceInfo)
    }
  }, [])
  
  return deviceInfo
}

// 检测 iPhone 型号（近似值），并支持默认为 iPhone 15 Pro Max
export function useIPhoneModel(): string {
  const { isIOS, width, height, userAgent } = useDeviceInfo()
  const [model, setModel] = React.useState<string>('iphone-pro-max') // 默认为 iPhone 15 Pro Max
  
  React.useEffect(() => {
    // 如果不是iOS设备但强制使用iPhone模式，则保持默认值
    if (!isIOS && width <= 0) {
      // 保持默认值 'iphone-pro-max'
      return;
    }
    
    // 如果确实不是iOS设备，则设置为非iPhone
    if (!isIOS && width > 0) {
      setModel('not-iphone')
      return
    }
    
    // 根据屏幕分辨率和用户代理推断 iPhone 型号
    const maxDimension = Math.max(width, height)
    
    // 更详细的判断逻辑
    if (maxDimension <= 667) {
      setModel('iphone-8-or-smaller') // iPhone 8 或更老机型
    } else if (maxDimension <= 812) {
      setModel('iphone-x-xs-11pro') // iPhone X、XS、11 Pro
    } else if (maxDimension <= 896) {
      setModel('iphone-xr-xs-max-11') // iPhone XR、XS Max、11
    } else if (maxDimension <= 926) {
      setModel('iphone-12-13-14') // iPhone 12、13、14 系列
    } else if (maxDimension <= 932) {
      setModel('iphone-pro-max') // 15 Pro Max
    } else {
      setModel('iphone-pro-max') // 默认使用最新Pro Max型号
    }
  }, [isIOS, width, height, userAgent])
  
  return model
}
