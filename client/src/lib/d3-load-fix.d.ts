/**
 * D3.js加载修复模块类型声明
 */

/**
 * 尝试加载D3.js并应用补丁
 * @returns 返回一个Promise，解析为boolean值，表示加载是否成功
 */
export default {
  isLoaded: () => boolean,
  applyPatch: () => void,
  forceReload: () => void
};