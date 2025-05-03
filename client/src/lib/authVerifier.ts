/**
 * Auth Verifier - 前端认证状态验证工具
 * 提供自动验证会话状态并修复前后端认证不一致的功能
 */

type User = {
  id: number;
  username: string;
  role: string;
};

/**
 * 验证当前会话状态
 * 检查前端存储的认证状态是否与后端一致
 * @returns Promise<User|null> 用户信息或null（未认证）
 */
export async function verifySession(): Promise<User | null> {
  try {
    console.log('[AuthVerifier] 开始验证会话状态');
    // 尝试调用后端验证API
    const response = await fetch('/api/auth/verify');
    
    // 如果返回不是200，说明没有有效会话
    if (!response.ok) {
      console.log(`[AuthVerifier] 服务器返回状态码 ${response.status}，会话无效`);
      // 清除本地存储的用户数据
      localStorage.removeItem('user');
      return null;
    }
    
    // 解析并返回用户数据
    const data = await response.json();
    console.log('[AuthVerifier] 验证响应数据:', data);
    
    if (data.success && data.user) {
      console.log('[AuthVerifier] 验证成功，用户ID:', data.user.id);
      // 更新本地存储的用户数据
      localStorage.setItem('user', JSON.stringify(data.user));
      return data.user;
    }
    
    console.log('[AuthVerifier] 验证失败，响应数据中无有效用户信息');
    // 清除本地存储的用户数据
    localStorage.removeItem('user');
    return null;
  } catch (error) {
    console.error('[AuthVerifier] 验证会话时出错:', error);
    // 发生错误时，清除本地存储
    localStorage.removeItem('user');
    return null;
  }
}

/**
 * 获取当前本地存储的用户数据
 * @returns User|null 用户信息或null
 */
export function getLocalUser(): User | null {
  try {
    console.log('[AuthVerifier] 读取本地存储的用户数据');
    const userJson = localStorage.getItem('user');
    
    if (!userJson) {
      console.log('[AuthVerifier] 本地不存在用户数据');
      return null;
    }
    
    try {
      const userData = JSON.parse(userJson);
      
      if (!userData || !userData.id) {
        console.log('[AuthVerifier] 本地用户数据格式无效，缺少必要字段');
        localStorage.removeItem('user');
        return null;
      }
      
      console.log(`[AuthVerifier] 在本地找到有效用户数据，ID=${userData.id}, 角色=${userData.role || '未知'}`);
      return userData;
    } catch (parseError) {
      console.error('[AuthVerifier] 解析本地用户数据失败:', parseError);
      localStorage.removeItem('user');
      return null;
    }
  } catch (error) {
    console.error('[AuthVerifier] 访问本地存储时出错:', error);
    return null;
  }
}

/**
 * 验证并确保会话一致性
 * 在应用启动或路由切换时调用
 * @returns Promise<User|null> 用户信息或null
 */
export async function ensureAuthConsistency(): Promise<User | null> {
  console.log('[AuthVerifier] 开始确保前端-后端认证状态一致性');
  
  // 先获取本地存储的用户状态
  const localUser = getLocalUser();
  
  // 如果本地没有用户状态，直接验证会话
  if (!localUser) {
    console.log('[AuthVerifier] 本地无用户数据，尝试验证服务器会话');
    return await verifySession();
  }
  
  console.log(`[AuthVerifier] 本地用户数据存在，验证与服务器会话是否一致`);
  // 如果本地有用户状态，验证它与后端是否一致
  const serverUser = await verifySession();
  
  // 如果后端会话无效但本地有用户数据，清除本地数据
  if (!serverUser && localUser) {
    console.log('[AuthVerifier] 前端-后端认证状态不一致：服务器无有效会话，但本地存在用户数据');
    console.log('[AuthVerifier] 清除本地存储的用户数据');
    localStorage.removeItem('user');
    return null;
  }
  
  if (serverUser) {
    console.log('[AuthVerifier] 前端-后端认证状态一致，用户ID:', serverUser.id);
  }
  
  return serverUser;
}

/**
 * 清除认证状态并重定向至登录页
 * 用于退出登录或认证失败时
 */
export function clearAuthAndRedirect(): void {
  localStorage.removeItem('user');
  window.location.href = '/login';
}
