import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { DashboardPage } from "@/components/admin/DashboardPage";
import { PromptTemplateManager } from "@/components/admin/PromptTemplateManager";
import { SystemSettingsModern } from "@/components/admin/SystemSettingsModern";
import { FeedbackAnalyticsModern } from "@/components/admin/FeedbackAnalyticsModern";
import { ContentModerationSettingsModern } from "@/components/admin/ContentModerationSettingsModern";
import { StudentAgentSimulatorModern } from "@/components/admin/StudentAgentSimulatorModern";

// 导入现代样式
import "@/components/admin/admin-modern.css";

export default function AdminDashboardModern() {
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState("dashboard");

  useEffect(() => {
    const userStr = localStorage.getItem("user");
    if (!userStr) {
      setLocation("/login");
      return;
    }

    const user = JSON.parse(userStr);
    if (user.role !== "admin") {
      setLocation("/login");
      return;
    }

    // 为管理员会话标记特殊属性，避免触发记忆系统
    localStorage.setItem("isAdminSession", "true");

    // 在组件卸载时清理
    return () => {
      if (user.role === "admin") {
        localStorage.removeItem("isAdminSession");
      }
    };
  }, [setLocation]);

  // 检测设备类型
  useEffect(() => {
    const checkDevice = () => {
      const userAgent = navigator.userAgent.toLowerCase();
      const isIPad = /ipad/.test(userAgent);
      const isIPhone = /iphone/.test(userAgent);
      const isAndroid = /android/.test(userAgent);
      const isMobile = isIPhone || isAndroid || (window.innerWidth < 768);
      const isTablet = isIPad || (window.innerWidth >= 768 && window.innerWidth < 1024);
      
      // 根据设备类型添加相应的类
      document.body.classList.toggle('ipad-device', isIPad);
      document.body.classList.toggle('mobile-device', isMobile);
      document.body.classList.toggle('tablet-device', isTablet);
      
      // 记录设备信息，便于调试
      if (isIPad || isIPhone) {
        console.log("检测到iPhone设备，应用移动布局优化");
      } else if (isAndroid) {
        console.log("检测到Android设备，应用移动布局优化");
      }
    };
    
    // 初始检测
    checkDevice();
    
    // 监听窗口大小变化，重新检测设备类型
    window.addEventListener('resize', checkDevice);
    
    // 清理函数
    return () => window.removeEventListener('resize', checkDevice);
  }, []);

  return (
    <AdminLayout activeTab={activeTab} onTabChange={setActiveTab}>
      {/* 仪表盘页面 */}
      {activeTab === "dashboard" && <DashboardPage />}
      
      {/* 安全设置页面 */}
      {activeTab === "security" && <SystemSettingsModern />}
      
      {/* 反馈分析页面 */}
      {activeTab === "feedback" && <FeedbackAnalyticsModern />}
      
      {/* 提示词模板页面 */}
      {activeTab === "prompts" && <PromptTemplateManager />}
      
      {/* 内容审查页面 */}
      {activeTab === "moderation" && <ContentModerationSettingsModern />}
      
      {/* 学生智能体页面 */}
      {activeTab === "student-agent" && <StudentAgentSimulatorModern />}
      
      {/* 系统设置页面 */}
      {activeTab === "system" && <SystemSettingsModern />}
    </AdminLayout>
  );
}