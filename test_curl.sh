#!/bin/bash

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== 提示词管理器功能测试脚本 ===${NC}"
echo -e "${BLUE}这个脚本将测试提示词模块化、模型切换和阶段变更功能${NC}"
echo ""

# 设置API基础URL
API_URL="http://localhost:5000/api"

# 步骤1: 创建测试聊天会话
echo -e "${BLUE}[步骤1] 创建测试聊天会话...${NC}"
CREATE_CHAT_RESPONSE=$(curl -s -X POST "$API_URL/chats" \
  -H "Content-Type: application/json" \
  -d '{"title":"提示词管理测试会话","model":"gemini"}')

# 提取聊天ID
CHAT_ID=$(echo $CREATE_CHAT_RESPONSE | grep -o '"id":[0-9]*' | cut -d':' -f2)

if [ -z "$CHAT_ID" ]; then
  echo -e "${RED}创建聊天会话失败!${NC}"
  exit 1
fi

echo -e "${GREEN}已创建测试聊天会话，ID: $CHAT_ID${NC}"
echo ""

# 步骤2: 设置初始对话阶段为K
echo -e "${BLUE}[步骤2] 设置初始对话阶段为K...${NC}"
curl -s -X POST "$API_URL/conversation/$CHAT_ID/phase" \
  -H "Content-Type: application/json" \
  -d '{"phase":"K"}' > /dev/null

echo -e "${GREEN}已设置初始对话阶段为K (Knowledge Activation)${NC}"
echo ""
sleep 1

# 步骤3: 发送第一条消息，使用gemini模型
echo -e "${BLUE}[步骤3] 发送第一条消息，使用gemini模型...${NC}"
curl -s -X POST "$API_URL/chats/$CHAT_ID/messages" \
  -H "Content-Type: application/json" \
  -d '{"content":"什么是异步编程？","model":"gemini"}' > /dev/null

echo -e "${GREEN}消息已发送${NC}"
echo -e "${YELLOW}请检查服务器日志，确认是否有\"使用增强版模块化提示词处理消息，模型: gemini\"的日志${NC}"
echo ""
sleep 3

# 步骤4: 设置阶段为W，测试阶段变更检测
echo -e "${BLUE}[步骤4] 设置对话阶段为W...${NC}"
curl -s -X POST "$API_URL/conversation/$CHAT_ID/phase" \
  -H "Content-Type: application/json" \
  -d '{"phase":"W"}' > /dev/null

echo -e "${GREEN}已设置对话阶段为W (Wondering)${NC}"
echo ""
sleep 1

# 步骤5: 发送第二条消息，仍使用gemini模型
echo -e "${BLUE}[步骤5] 发送第二条消息，仍使用gemini模型...${NC}"
curl -s -X POST "$API_URL/chats/$CHAT_ID/messages" \
  -H "Content-Type: application/json" \
  -d '{"content":"异步编程与多线程编程的区别是什么？","model":"gemini"}' > /dev/null

echo -e "${GREEN}消息已发送${NC}"
echo -e "${YELLOW}请检查服务器日志，确认是否有\"检测到阶段变更: K -> W\"的日志${NC}"
echo ""
sleep 3

# 步骤6: 切换到deepseek模型，测试模型切换检测
echo -e "${BLUE}[步骤6] 发送第三条消息，切换到deepseek模型...${NC}"
curl -s -X POST "$API_URL/chats/$CHAT_ID/messages" \
  -H "Content-Type: application/json" \
  -d '{"content":"异步编程在JavaScript中如何实现？","model":"deepseek"}' > /dev/null

echo -e "${GREEN}消息已发送${NC}"
echo -e "${YELLOW}请检查服务器日志，确认是否有\"检测到模型切换，将在提示词中添加模型切换校验\"的日志${NC}"
echo ""
sleep 3

# 步骤7: 获取测试结果
echo -e "${BLUE}[步骤7] 获取聊天历史...${NC}"
MESSAGES_RESPONSE=$(curl -s "$API_URL/chats/$CHAT_ID/messages")
MESSAGE_COUNT=$(echo $MESSAGES_RESPONSE | grep -o '"id"' | wc -l)

echo -e "${GREEN}获取到 $MESSAGE_COUNT 条消息${NC}"
echo ""

# 总结测试结果
echo -e "${BLUE}===== 测试结果汇总 =====${NC}"
echo -e "${YELLOW}请检查服务器日志中是否有以下内容:${NC}"
echo -e "${YELLOW}1. \"使用增强版模块化提示词处理消息\"${NC}"
echo -e "${YELLOW}2. \"检测到阶段变更: K -> W\"${NC}"
echo -e "${YELLOW}3. \"检测到模型切换，将在提示词中添加模型切换校验\"${NC}"
echo ""
echo -e "${BLUE}测试完成!${NC}"