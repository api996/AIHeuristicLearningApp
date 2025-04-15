import React, { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Trash, Info } from 'lucide-react';

// 提示词模板管理组件
export function PromptTemplateManager() {
  const { toast } = useToast();
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedModel, setSelectedModel] = useState('gemini');
  const [promptTemplate, setPromptTemplate] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // 可用模型列表
  const availableModels = [
    { id: 'gemini', name: 'Gemini' },
    { id: 'deep', name: 'Deep' },
    { id: 'deepseek', name: 'DeepSeek' },
    { id: 'grok', name: 'Grok' },
    { id: 'search', name: 'Search' },
  ];

  // 获取所有提示词模板
  const fetchTemplates = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/prompts');
      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data)) {
          setTemplates(data);
          toast({
            title: "模板加载成功",
            description: `已加载 ${data.length} 个提示词模板`
          });
        }
      } else {
        toast({
          title: "加载失败",
          description: "无法获取提示词模板",
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "加载错误",
        description: String(error),
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  // 加载特定模型的模板
  const loadModelTemplate = (modelId: string) => {
    setSelectedModel(modelId);
    
    // 查找是否已有此模型的模板
    const existingTemplate = templates.find(t => t.modelId === modelId);
    if (existingTemplate) {
      setPromptTemplate(existingTemplate.promptTemplate);
      setIsEditing(true);
    } else {
      // 设置空模板或默认模板
      setPromptTemplate(getDefaultTemplate(modelId));
      setIsEditing(false);
    }
  };

  // 获取模型的默认模板
  const getDefaultTemplate = (modelId: string) => {
    const defaultTemplates: Record<string, string> = {
      gemini: `你是一个有帮助的AI学习助手，专注于提供高质量的学习体验。

用户当前问题: {{user_input}}

{{#if memory}}
用户历史记忆:
{{memory}}
{{/if}}

{{#if search}}
网络搜索结果:
{{search}}
{{/if}}

请提供详细、有帮助的回答。`,

      deep: `你是一个多语言AI学习助手，专注于提供深入的学习体验和知识分析。

用户当前问题: {{user_input}}

{{#if memory}}
用户历史记忆:
{{memory}}
{{/if}}

{{#if search}}
网络搜索结果:
{{search}}
{{/if}}

请提供详细、有深度的回答，体现出专业的分析和洞察。`,

      search: `你是一个专注于搜索和信息整合的AI助手。

用户当前问题: {{user_input}}

{{#if memory}}
用户历史记忆:
{{memory}}
{{/if}}

搜索结果:
{{search}}

请基于搜索结果，提供结构化、全面的回答，并标注信息来源。`,

      deepseek: `你是DeepSeek模型，一个专注于深度思考和分析的AI。

用户问题: {{user_input}}

{{#if memory}}
相关上下文:
{{memory}}
{{/if}}

{{#if search}}
参考资料:
{{search}}
{{/if}}

请分析问题的核心，提供深入、系统的回答。`,

      grok: `你是Grok，一个具有轻松风格但富有智慧的AI助手。

用户问题: {{user_input}}

{{#if memory}}
相关记忆:
{{memory}}
{{/if}}

{{#if search}}
网络数据:
{{search}}
{{/if}}

请提供既有深度又不失幽默的回答。`
    };

    return defaultTemplates[modelId] || '';
  };

  // 保存提示词模板
  const saveTemplate = async () => {
    if (!promptTemplate || !selectedModel) {
      toast({
        title: "无法保存",
        description: "请提供完整的模板内容和模型ID",
        variant: "destructive"
      });
      return;
    }

    try {
      setSaveLoading(true);
      const response = await fetch('/api/admin/prompts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          modelId: selectedModel,
          promptTemplate: promptTemplate
        })
      });

      if (response.ok) {
        toast({
          title: "保存成功",
          description: `${selectedModel} 模型的提示词模板已更新`
        });
        await fetchTemplates(); // 重新加载所有模板
      } else {
        const error = await response.text();
        toast({
          title: "保存失败",
          description: error || "无法保存提示词模板",
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "保存错误",
        description: String(error),
        variant: "destructive"
      });
    } finally {
      setSaveLoading(false);
    }
  };

  // 删除提示词模板
  const deleteTemplate = async () => {
    if (!selectedModel) return;

    try {
      setDeleteLoading(true);
      const response = await fetch(`/api/admin/prompts/${selectedModel}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        toast({
          title: "删除成功",
          description: `${selectedModel} 模型的提示词模板已删除`
        });
        setPromptTemplate('');
        setIsEditing(false);
        await fetchTemplates(); // 重新加载所有模板
      } else {
        const error = await response.text();
        toast({
          title: "删除失败",
          description: error || "无法删除提示词模板",
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "删除错误",
        description: String(error),
        variant: "destructive"
      });
    } finally {
      setDeleteLoading(false);
    }
  };

  // 首次加载时获取所有模板
  useEffect(() => {
    fetchTemplates();
  }, []);

  // 初始选择第一个模型
  useEffect(() => {
    if (templates.length > 0) {
      loadModelTemplate(templates[0].modelId);
    } else if (availableModels.length > 0) {
      loadModelTemplate(availableModels[0].id);
    }
  }, [templates]);

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>提示词模板管理</CardTitle>
        <CardDescription>
          设置各个模型使用的提示词模板，支持变量插值和条件逻辑
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-center space-x-4">
            <div className="w-1/4">
              <Label htmlFor="model-select">选择模型</Label>
              <Select
                value={selectedModel}
                onValueChange={(value) => loadModelTemplate(value)}
                disabled={loading}
              >
                <SelectTrigger id="model-select">
                  <SelectValue placeholder="选择模型" />
                </SelectTrigger>
                <SelectContent>
                  {availableModels.map(model => (
                    <SelectItem key={model.id} value={model.id}>
                      {model.name}
                      {templates.some(t => t.modelId === model.id) ? ' (已配置)' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center space-x-2 mt-6">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="outline" size="icon">
                      <Info className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-md">
                    <p>提示词模板支持以下变量：</p>
                    <ul className="list-disc pl-4 mt-1">
                      <li>用户输入: <code>{'{{user_input}}'}</code></li>
                      <li>当前日期: <code>{'{{date}}'}</code></li>
                      <li>记忆上下文: <code>{'{{memory}}'}</code></li>
                      <li>搜索结果: <code>{'{{search}}'}</code></li>
                      <li>条件逻辑: <code>{'{{#if memory}}'}</code>内容<code>{'{{/if}}'}</code></li>
                    </ul>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>

          <div>
            <Label htmlFor="prompt-template">
              提示词模板
              {isEditing && <span className="ml-2 text-green-600 text-sm">(已存在)</span>}
            </Label>
            <Textarea
              id="prompt-template"
              value={promptTemplate}
              onChange={(e) => setPromptTemplate(e.target.value)}
              placeholder="输入提示词模板..."
              className="min-h-[300px] font-mono text-sm mt-2"
              disabled={loading}
            />
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex justify-between">
        <Button
          variant="outline"
          onClick={() => loadModelTemplate(selectedModel)}
          disabled={loading}
        >
          重置
        </Button>
        <div className="space-x-2">
          {isEditing && (
            <Button
              variant="destructive"
              onClick={deleteTemplate}
              disabled={loading || deleteLoading}
            >
              {deleteLoading ? "删除中..." : "删除模板"}
              <Trash className="ml-2 h-4 w-4" />
            </Button>
          )}
          <Button
            onClick={saveTemplate}
            disabled={loading || saveLoading || !promptTemplate}
          >
            {saveLoading ? "保存中..." : (isEditing ? "更新模板" : "创建模板")}
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}

export default PromptTemplateManager;