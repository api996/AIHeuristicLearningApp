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
import { Trash, Info, LampDesk, HelpCircle, Lightbulb, BookOpen, AlignVerticalJustifyCenter, Pencil } from 'lucide-react';

// 提示词模板接口
interface PromptTemplate {
  id: number;
  modelId: string;
  promptTemplate: string;
  baseTemplate?: string;
  kTemplate?: string;
  wTemplate?: string;
  lTemplate?: string;
  qTemplate?: string;
  styleTemplate?: string;
  policyTemplate?: string;
  sensitiveWords?: string;
  updatedAt: string;
  createdBy: number;
}

// 提示词模板管理组件
export function PromptTemplateManager() {
  const { toast } = useToast();
  const [templates, setTemplates] = useState<PromptTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedModel, setSelectedModel] = useState('gemini');
  const [promptTemplate, setPromptTemplate] = useState('');
  const [baseTemplate, setBaseTemplate] = useState('');
  const [kTemplate, setKTemplate] = useState('');
  const [wTemplate, setWTemplate] = useState('');
  const [lTemplate, setLTemplate] = useState('');
  const [qTemplate, setQTemplate] = useState('');
  const [styleTemplate, setStyleTemplate] = useState('');
  const [policyTemplate, setPolicyTemplate] = useState('');
  const [sensitiveWords, setSensitiveWords] = useState('');
  const [activePromptTab, setActivePromptTab] = useState('base');
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

  // 获取当前登录的管理员用户ID
  const getCurrentUserId = (): number | null => {
    try {
      const userStr = localStorage.getItem("user");
      if (!userStr) return null;
      const user = JSON.parse(userStr);
      return user.userId || null;
    } catch (error) {
      console.error("获取用户信息失败:", error);
      return null;
    }
  };

  // 获取所有提示词模板
  const fetchTemplates = async () => {
    try {
      setLoading(true);
      const userId = getCurrentUserId();
      if (!userId) {
        toast({
          title: "认证错误",
          description: "未找到用户信息，请重新登录",
          variant: "destructive"
        });
        return;
      }

      const response = await fetch(`/api/admin/prompts?userId=${userId}`);
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
        const errorText = await response.text();
        toast({
          title: "加载失败",
          description: errorText || "无法获取提示词模板",
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
      // 加载所有模板字段
      setPromptTemplate(existingTemplate.promptTemplate || '');
      setBaseTemplate(existingTemplate.baseTemplate || '');
      setKTemplate(existingTemplate.kTemplate || '');
      setWTemplate(existingTemplate.wTemplate || '');
      setLTemplate(existingTemplate.lTemplate || '');
      setQTemplate(existingTemplate.qTemplate || '');
      setStyleTemplate(existingTemplate.styleTemplate || '');
      setPolicyTemplate(existingTemplate.policyTemplate || '');
      setSensitiveWords(existingTemplate.sensitiveWords || '');
      setIsEditing(true);
    } else {
      // 设置默认模板
      const defaultPrompt = getDefaultTemplate(modelId);
      setPromptTemplate(defaultPrompt);
      setBaseTemplate(defaultPrompt);
      setKTemplate('');
      setWTemplate('');
      setLTemplate('');
      setQTemplate('');
      setStyleTemplate('');
      setPolicyTemplate('');
      setSensitiveWords('');
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
    if (!selectedModel) {
      toast({
        title: "无法保存",
        description: "请选择一个模型",
        variant: "destructive"
      });
      return;
    }

    // 基础提示词模板必须存在
    const currentTemplate = activePromptTab === 'base' ? baseTemplate : 
                           activePromptTab === 'knowledge' ? kTemplate : 
                           activePromptTab === 'wisdom' ? wTemplate : 
                           activePromptTab === 'logic' ? lTemplate : 
                           activePromptTab === 'question' ? qTemplate : 
                           activePromptTab === 'style' ? styleTemplate : 
                           activePromptTab === 'policy' ? policyTemplate : 
                           activePromptTab === 'sensitive' ? sensitiveWords : 
                           promptTemplate;

    if (activePromptTab === 'base' && !currentTemplate) {
      toast({
        title: "无法保存",
        description: "基础提示词模板不能为空",
        variant: "destructive"
      });
      return;
    }

    try {
      setSaveLoading(true);
      const userId = getCurrentUserId();
      if (!userId) {
        toast({
          title: "认证错误",
          description: "未找到用户信息，请重新登录",
          variant: "destructive"
        });
        return;
      }

      const response = await fetch('/api/admin/prompts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          modelId: selectedModel,
          promptTemplate: promptTemplate,
          baseTemplate: baseTemplate,
          kTemplate: kTemplate,
          wTemplate: wTemplate,
          lTemplate: lTemplate,
          qTemplate: qTemplate,
          styleTemplate: styleTemplate,
          policyTemplate: policyTemplate,
          sensitiveWords: sensitiveWords,
          userId: userId
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
      const userId = getCurrentUserId();
      if (!userId) {
        toast({
          title: "认证错误",
          description: "未找到用户信息，请重新登录",
          variant: "destructive"
        });
        return;
      }

      const response = await fetch(`/api/admin/prompts/${selectedModel}?userId=${userId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        toast({
          title: "删除成功",
          description: `${selectedModel} 模型的提示词模板已删除`
        });
        // 清空所有模板字段
        setPromptTemplate('');
        setBaseTemplate('');
        setKTemplate('');
        setWTemplate('');
        setLTemplate('');
        setQTemplate('');
        setStyleTemplate('');
        setPolicyTemplate('');
        setSensitiveWords('');
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
  
  // 根据当前选中的标签获取对应的提示词模板
  const getCurrentTemplateValue = () => {
    switch (activePromptTab) {
      case 'legacy': return promptTemplate; 
      case 'base': return baseTemplate;
      case 'knowledge': return kTemplate;
      case 'wisdom': return wTemplate;
      case 'logic': return lTemplate;
      case 'question': return qTemplate;
      case 'style': return styleTemplate;
      case 'policy': return policyTemplate;
      case 'sensitive': return sensitiveWords;
      default: return promptTemplate;
    }
  };

  // 根据当前选中的标签设置对应的提示词模板
  const setCurrentTemplateValue = (value: string) => {
    switch (activePromptTab) {
      case 'legacy': setPromptTemplate(value); break;
      case 'base': setBaseTemplate(value); break;
      case 'knowledge': setKTemplate(value); break;
      case 'wisdom': setWTemplate(value); break;
      case 'logic': setLTemplate(value); break;
      case 'question': setQTemplate(value); break;
      case 'style': setStyleTemplate(value); break;
      case 'policy': setPolicyTemplate(value); break;
      case 'sensitive': setSensitiveWords(value); break;
      default: setPromptTemplate(value);
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
          设置各个模型使用的提示词模板，支持多阶段动态提示词注入
        </CardDescription>
        <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-950 rounded-md text-sm">
          <h4 className="font-semibold mb-1">多阶段提示词系统</h4>
          <p className="mb-2">本系统基于KWLQ教育模型实现了多阶段提示词，能根据对话阶段动态注入不同的提示词内容：</p>
          <ul className="list-disc pl-5 space-y-1">
            <li><span className="font-semibold">K阶段</span>：知识传授，提供基础信息和事实</li>
            <li><span className="font-semibold">W阶段</span>：智慧分享，提供深度洞察和观点</li>
            <li><span className="font-semibold">L阶段</span>：逻辑思考，分析问题和推理过程</li>
            <li><span className="font-semibold">Q阶段</span>：提问引导，促进用户自我思考</li>
          </ul>
          <p className="mt-2 text-blue-600 dark:text-blue-400">系统会通过AI分析对话内容，自动判断当前所处阶段并动态注入对应提示词</p>
        </div>
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
            <div className="mb-4">
              <Label htmlFor="prompt-template" className="mb-2 block">
                提示词模板 - {isEditing && <span className="text-green-600">(已配置)</span>}
              </Label>
              
              <Tabs value={activePromptTab} onValueChange={setActivePromptTab} className="w-full">
                <TabsList className="w-full grid grid-cols-2 lg:grid-cols-4 mb-4">
                  <TabsTrigger value="legacy" className="flex items-center">
                    <Pencil className="h-4 w-4 mr-1" />
                    <span>传统模板</span>
                  </TabsTrigger>
                  <TabsTrigger value="base" className="flex items-center">
                    <AlignVerticalJustifyCenter className="h-4 w-4 mr-1" />
                    <span>基础模板</span>
                  </TabsTrigger>
                  <TabsTrigger value="knowledge" className="flex items-center">
                    <BookOpen className="h-4 w-4 mr-1" />
                    <span>K-知识阶段</span>
                  </TabsTrigger>
                  <TabsTrigger value="wisdom" className="flex items-center">
                    <Lightbulb className="h-4 w-4 mr-1" />
                    <span>W-智慧阶段</span>
                  </TabsTrigger>
                  <TabsTrigger value="logic" className="flex items-center">
                    <LampDesk className="h-4 w-4 mr-1" />
                    <span>L-逻辑阶段</span>
                  </TabsTrigger>
                  <TabsTrigger value="question" className="flex items-center">
                    <HelpCircle className="h-4 w-4 mr-1" />
                    <span>Q-提问阶段</span>
                  </TabsTrigger>
                  <TabsTrigger value="style" className="flex items-center">
                    <Pencil className="h-4 w-4 mr-1" />
                    <span>表达风格</span>
                  </TabsTrigger>
                  <TabsTrigger value="policy" className="flex items-center">
                    <Info className="h-4 w-4 mr-1" />
                    <span>策略约束</span>
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="legacy" className="mt-0">
                  <div className="bg-slate-100 dark:bg-slate-800 p-2 rounded mb-1">
                    <p className="text-xs text-slate-500">传统单一提示词模板 (向后兼容)</p>
                  </div>
                  <Textarea
                    id="legacy-template"
                    value={promptTemplate}
                    onChange={(e) => setPromptTemplate(e.target.value)}
                    placeholder="输入传统格式的提示词模板..."
                    className="min-h-[300px] font-mono text-sm"
                    disabled={loading}
                  />
                </TabsContent>
                
                <TabsContent value="base" className="mt-0">
                  <div className="bg-slate-100 dark:bg-slate-800 p-2 rounded mb-1">
                    <p className="text-xs text-slate-500">基础提示词模板，定义模型的基本行为和角色</p>
                  </div>
                  <Textarea
                    id="base-template"
                    value={baseTemplate}
                    onChange={(e) => setBaseTemplate(e.target.value)}
                    placeholder="输入基础提示词模板..."
                    className="min-h-[300px] font-mono text-sm"
                    disabled={loading}
                  />
                </TabsContent>
                
                <TabsContent value="knowledge" className="mt-0">
                  <div className="bg-slate-100 dark:bg-slate-800 p-2 rounded mb-1">
                    <p className="text-xs text-slate-500">知识阶段 (K) - 定义模型在提供知识时的行为</p>
                  </div>
                  <Textarea
                    id="k-template"
                    value={kTemplate}
                    onChange={(e) => setKTemplate(e.target.value)}
                    placeholder="输入知识阶段 (K) 提示词模板..."
                    className="min-h-[300px] font-mono text-sm"
                    disabled={loading}
                  />
                </TabsContent>
                
                <TabsContent value="wisdom" className="mt-0">
                  <div className="bg-slate-100 dark:bg-slate-800 p-2 rounded mb-1">
                    <p className="text-xs text-slate-500">智慧阶段 (W) - 定义模型在提供见解和智慧时的行为</p>
                  </div>
                  <Textarea
                    id="w-template"
                    value={wTemplate}
                    onChange={(e) => setWTemplate(e.target.value)}
                    placeholder="输入智慧阶段 (W) 提示词模板..."
                    className="min-h-[300px] font-mono text-sm"
                    disabled={loading}
                  />
                </TabsContent>
                
                <TabsContent value="logic" className="mt-0">
                  <div className="bg-slate-100 dark:bg-slate-800 p-2 rounded mb-1">
                    <p className="text-xs text-slate-500">逻辑阶段 (L) - 定义模型在进行推理和分析时的行为</p>
                  </div>
                  <Textarea
                    id="l-template"
                    value={lTemplate}
                    onChange={(e) => setLTemplate(e.target.value)}
                    placeholder="输入逻辑阶段 (L) 提示词模板..."
                    className="min-h-[300px] font-mono text-sm"
                    disabled={loading}
                  />
                </TabsContent>
                
                <TabsContent value="question" className="mt-0">
                  <div className="bg-slate-100 dark:bg-slate-800 p-2 rounded mb-1">
                    <p className="text-xs text-slate-500">提问阶段 (Q) - 定义模型在引导用户思考和提问时的行为</p>
                  </div>
                  <Textarea
                    id="q-template"
                    value={qTemplate}
                    onChange={(e) => setQTemplate(e.target.value)}
                    placeholder="输入提问阶段 (Q) 提示词模板..."
                    className="min-h-[300px] font-mono text-sm"
                    disabled={loading}
                  />
                </TabsContent>
                
                <TabsContent value="style" className="mt-0">
                  <div className="bg-slate-100 dark:bg-slate-800 p-2 rounded mb-1">
                    <p className="text-xs text-slate-500">表达风格 - 定义模型的语言风格、语调和表达方式</p>
                  </div>
                  <Textarea
                    id="style-template"
                    value={styleTemplate}
                    onChange={(e) => setStyleTemplate(e.target.value)}
                    placeholder="输入风格提示词模板..."
                    className="min-h-[300px] font-mono text-sm"
                    disabled={loading}
                  />
                </TabsContent>
                
                <TabsContent value="policy" className="mt-0">
                  <div className="bg-slate-100 dark:bg-slate-800 p-2 rounded mb-1">
                    <p className="text-xs text-slate-500">策略约束 - 定义模型的安全边界、禁止话题和行为约束</p>
                  </div>
                  <Textarea
                    id="policy-template"
                    value={policyTemplate}
                    onChange={(e) => setPolicyTemplate(e.target.value)}
                    placeholder="输入策略约束提示词模板..."
                    className="min-h-[300px] font-mono text-sm"
                    disabled={loading}
                  />
                </TabsContent>
                
                <TabsContent value="sensitive" className="mt-0">
                  <div className="bg-slate-100 dark:bg-slate-800 p-2 rounded mb-1">
                    <p className="text-xs text-slate-500">敏感词列表 - 定义模型需要特别注意或避免的特定词汇，每行一个</p>
                  </div>
                  <Textarea
                    id="sensitive-words"
                    value={sensitiveWords}
                    onChange={(e) => setSensitiveWords(e.target.value)}
                    placeholder="输入敏感词列表，每行一个..."
                    className="min-h-[300px] font-mono text-sm"
                    disabled={loading}
                  />
                </TabsContent>
              </Tabs>
            </div>
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
            disabled={loading || saveLoading || (activePromptTab === 'base' && !baseTemplate) || 
                     (activePromptTab === 'legacy' && !promptTemplate)}
          >
            {saveLoading ? "保存中..." : (isEditing ? "更新模板" : "创建模板")}
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}

export default PromptTemplateManager;