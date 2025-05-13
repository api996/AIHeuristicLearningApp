   <p>
    <strong>启发式对话导学系统</strong>
  </p>
  
  <p>
    <a href="#"><img src="https://img.shields.io/badge/版本-1.0.0-brightgreen" alt="Version 1.0.0"></a>
    <a href="#"><img src="https://img.shields.io/badge/许可证-MIT-blue" alt="License: MIT"></a>
    <a href="#"><img src="https://img.shields.io/badge/Node.js-v20-success" alt="Node.js v20"></a>
    <a href="#"><img src="https://img.shields.io/badge/部署-Vercel_Ready-black" alt="Vercel Ready"></a>
    <a href="#"><img src="https://img.shields.io/badge/状态-稳定-success" alt="Status: Stable"></a>
  </p>
  
  <p>
    <a href="#核心能力">核心能力</a> •
    <a href="#系统架构">系统架构</a> •
    <a href="#快速开始">快速开始</a> •
    <a href="#技术特性">技术特性</a> •
    <a href="#部署">部署</a> •
  </p>
  
  <br/>
  
  <img src="https://via.placeholder.com/800x450.png?text=启发式导师+系统界面预览" alt="启发式导师系统预览" width="80%">
</div>

## 📚 简介

**启发式导师**是一个融合多种先进大语言模型的智能教育平台，通过KWLQ学习模型、知识图谱可视化和先进的记忆管理系统，打造个性化、沉浸式的学习体验。系统能够理解学习者的需求，提供定制化的学习指导，并通过交互式知识探索促进深度学习。

### 为什么选择启发式导师？

- 🧠 **认知科学驱动** - 基于KWLQ学习框架设计，优化知识获取和记忆形成
- 🔍 **语义理解能力** - 使用3072维高精度向量嵌入，捕捉复杂概念间的细微关系
- 🌐 **多模型协同** - 无缝整合Grok、DeepSeek、Gemini等顶尖AI模型，智能路由最适合的模型处理不同类型的问题
- 🔄 **持久化交互** - 即使在网络不稳定情况下，也能确保学习进度不丢失
- 📊 **数据驱动洞察** - 通过聚类分析和知识图谱生成，揭示学习模式和知识关联

<br/>

## 🔥 核心能力

<div align="center">
  <table>
    <tr>
      <td align="center" width="33%">
        <img src="https://via.placeholder.com/80x80.png?text=AI" width="80px"><br/>
        <strong>多模型协作</strong><br/>
        <small>智能模型选择与负载均衡</small>
      </td>
      <td align="center" width="33%">
        <img src="https://via.placeholder.com/80x80.png?text=RAG" width="80px"><br/>
        <strong>检索增强生成</strong><br/>
        <small>结合历史记忆与网络知识</small>
      </td>
      <td align="center" width="33%">
        <img src="https://via.placeholder.com/80x80.png?text=3D" width="80px"><br/>
        <strong>知识图谱</strong><br/>
        <small>交互式3D知识可视化</small>
      </td>
    </tr>
    <tr>
      <td align="center">
        <img src="https://via.placeholder.com/80x80.png?text=DB" width="80px"><br/>
        <strong>持久化记忆</strong><br/>
        <small>高维向量数据库</small>
      </td>
      <td align="center">
        <img src="https://via.placeholder.com/80x80.png?text=KWLQ" width="80px"><br/>
        <strong>KWLQ框架</strong><br/>
        <small>结构化学习方法论</small>
      </td>
      <td align="center">
        <img src="https://via.placeholder.com/80x80.png?text=ML" width="80px"><br/>
        <strong>自适应学习</strong><br/>
        <small>个性化学习路径生成</small>
      </td>
    </tr>
  </table>
</div>

<br/>

## 🏗️ 系统架构

启发式导师采用模块化、可伸缩的现代系统架构：

```mermaid
graph TD
    A[用户界面] --> B[会话管理器]
    B --> C{路由选择器}
    C -->|Grok模型| D[Grok服务]
    C -->|DeepSeek模型| E[DeepSeek服务]
    C -->|Gemini模型| F[Gemini服务]
    C -->|Dify模型| G[Dify服务]
    D & E & F & G --> H[响应处理器]
    H --> I[持久化延迟响应管理器]
    I --> J[数据库存储]
    B --> K[记忆检索系统]
    K --> L[向量嵌入管理器]
    L --> M[聚类分析引擎]
    M --> N[知识图谱生成器]
    N --> O[学习路径构建器]
    O --> P[学习建议生成器]
    P --> B
