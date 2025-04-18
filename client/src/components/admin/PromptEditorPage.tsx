import React, { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChevronLeft, Save, RotateCcw, Trash, BookOpen, Lightbulb, LampDesk, HelpCircle, Pencil, Settings } from 'lucide-react';
import { Separator } from '@/components/ui/separator';

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

export function PromptEditorPage() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [loading, setLoading] = useState(true);
  const [templatesList, setTemplatesList] = useState<PromptTemplate[]>([]);
  const [selectedModel, setSelectedModel] = useState('');
  const [activeTab, setActiveTab] = useState('base');
  
  // 提示词模板内容
  const [promptTemplate, setPromptTemplate] = useState('');
  const [baseTemplate, setBaseTemplate] = useState('');
  const [kTemplate, setKTemplate] = useState('');
  const [wTemplate, setWTemplate] = useState('');
  const [lTemplate, setLTemplate] = useState('');
  const [qTemplate, setQTemplate] = useState('');
  const [styleTemplate, setStyleTemplate] = useState('');
  const [policyTemplate, setPolicyTemplate] = useState('');
  const [sensitiveWords, setSensitiveWords] = useState('');
  
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
          setTemplatesList(data);
          
          // 如果有模板并且还没有选择模型，默认选择第一个
          if (data.length > 0 && !selectedModel) {
            setSelectedModel(data[0].modelId);
            loadModelTemplate(data[0].modelId, data);
          }
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
  const loadModelTemplate = (modelId: string, templateList?: PromptTemplate[]) => {
    setSelectedModel(modelId);
    
    // 使用传入的模板列表或状态中的模板列表
    const templateData = templateList || templatesList;
    
    // 查找是否已有此模型的模板
    const existingTemplate = templateData.find((t: PromptTemplate) => t.modelId === modelId);
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

    // 至少需要基础模板
    if (!baseTemplate && !promptTemplate) {
      toast({
        title: "无法保存",
        description: "至少需要提供基础提示词模板",
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
          promptTemplate: promptTemplate || baseTemplate, // 向后兼容
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

  // 根据当前选中的标签获取对应的模板和设置函数
  const getTemplateContent = (tab: string) => {
    switch (tab) {
      case 'base': return { value: baseTemplate, setter: setBaseTemplate, placeholder: "输入基础提示词模板，定义模型的基本行为和角色..." };
      case 'knowledge': return { value: kTemplate, setter: setKTemplate, placeholder: "输入知识阶段 (K) 提示词模板，侧重于知识传授..." };
      case 'wisdom': return { value: wTemplate, setter: setWTemplate, placeholder: "输入智慧阶段 (W) 提示词模板，侧重于提供观点和见解..." };
      case 'logic': return { value: lTemplate, setter: setLTemplate, placeholder: "输入逻辑阶段 (L) 提示词模板，侧重于问题分析和推理..." };
      case 'question': return { value: qTemplate, setter: setQTemplate, placeholder: "输入提问阶段 (Q) 提示词模板，侧重于引导用户思考..." };
      case 'style': return { value: styleTemplate, setter: setStyleTemplate, placeholder: "输入风格提示词模板，定义语言风格和表达方式..." };
      case 'policy': return { value: policyTemplate, setter: setPolicyTemplate, placeholder: "输入策略约束提示词模板，定义安全边界和行为规范..." };
      case 'sensitive': return { value: sensitiveWords, setter: setSensitiveWords, placeholder: "输入敏感词列表，每行一个词..." };
      default: return { value: baseTemplate, setter: setBaseTemplate, placeholder: "输入基础提示词模板..." };
    }
  };

  // 获取当前标签的标题和描述
  const getTabInfo = (tab: string): { title: string; description: string; icon: React.ReactNode } => {
    switch (tab) {
      case 'base':
        return { 
          title: "基础提示词模板", 
          description: "定义模型的基本行为、角色和总体框架，所有对话阶段的基础",
          icon: <Settings className="h-5 w-5 mr-2" />
        };
      case 'knowledge':
        return { 
          title: "知识阶段 (K)", 
          description: "定义模型在传授知识和提供信息时的行为表现，侧重于事实和数据",
          icon: <BookOpen className="h-5 w-5 mr-2" />
        };
      case 'wisdom':
        return { 
          title: "智慧阶段 (W)", 
          description: "定义模型在提供见解和观点时的行为表现，侧重于理解和领悟",
          icon: <Lightbulb className="h-5 w-5 mr-2" />
        };
      case 'logic':
        return { 
          title: "逻辑阶段 (L)", 
          description: "定义模型在分析问题和推理时的行为表现，侧重于思维过程和逻辑",
          icon: <LampDesk className="h-5 w-5 mr-2" />
        };
      case 'question':
        return { 
          title: "提问阶段 (Q)", 
          description: "定义模型在引导用户思考和提问时的行为表现，侧重于启发和引导",
          icon: <HelpCircle className="h-5 w-5 mr-2" />
        };
      case 'style':
        return { 
          title: "表达风格", 
          description: "定义模型的语言风格、语调和表达方式",
          icon: <Pencil className="h-5 w-5 mr-2" />
        };
      case 'policy':
        return { 
          title: "策略约束", 
          description: "定义模型的安全边界、禁止话题和行为约束",
          icon: <Settings className="h-5 w-5 mr-2" />
        };
      case 'sensitive':
        return { 
          title: "敏感词列表", 
          description: "定义模型需要特别注意或避免的特定词汇，每行一个",
          icon: <Settings className="h-5 w-5 mr-2" />
        };
      default:
        return { 
          title: "提示词模板", 
          description: "定义模型的行为和响应方式",
          icon: <Settings className="h-5 w-5 mr-2" />
        };
    }
  };

  // 首次加载时获取所有模板
  useEffect(() => {
    fetchTemplates();
  }, []);

  const currentTab = getTabInfo(activeTab);
  const templateContent = getTemplateContent(activeTab);

  return (
    <div className="min-h-screen bg-black py-6">
      <div className="container px-4 mx-auto max-w-6xl">
        <div className="mb-6 flex items-center">
          <Button 
            variant="default" 
            onClick={() => navigate('/admin')}
            className="mr-3 bg-blue-600 hover:bg-blue-700"
          >
            <ChevronLeft className="h-4 w-4 mr-1" /> 返回
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-white">提示词模板编辑器</h1>
            <p className="text-sm text-gray-300">基于KWLQ教育模型的多阶段动态提示词系统</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* 左侧边栏 */}
          <div className="lg:col-span-1">
            <Card className="bg-neutral-900 border-neutral-800">
              <CardHeader>
                <CardTitle className="text-lg text-white">模型选择</CardTitle>
                <CardDescription className="text-gray-300">选择要编辑的模型</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="model-select" className="text-gray-200">AI模型</Label>
                    <Select
                      value={selectedModel}
                      onValueChange={(value) => loadModelTemplate(value)}
                      disabled={loading}
                    >
                      <SelectTrigger id="model-select" className="w-full bg-neutral-800 border-neutral-700 text-white">
                        <SelectValue placeholder="选择模型" />
                      </SelectTrigger>
                      <SelectContent className="bg-neutral-800 border-neutral-700 text-white">
                        {availableModels.map(model => (
                          <SelectItem key={model.id} value={model.id} className="focus:bg-blue-600 focus:text-white hover:bg-neutral-700">
                            {model.name}
                            {templatesList.some((t: PromptTemplate) => t.modelId === model.id) ? ' (已配置)' : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <Separator className="my-4 bg-neutral-700" />

                  <div className="space-y-1">
                    <Label className="mb-2 block text-gray-200">提示词类型</Label>
                    <Tabs value={activeTab} onValueChange={setActiveTab} orientation="vertical">
                      <TabsList className="w-full flex flex-col h-auto bg-transparent border-r border-neutral-700 space-y-1">
                        <TabsTrigger 
                          value="base" 
                          className="justify-start text-white data-[state=active]:bg-blue-600 data-[state=active]:text-white"
                        >
                          <Settings className="h-4 w-4 mr-2" />
                          基础模板
                        </TabsTrigger>
                        <TabsTrigger 
                          value="knowledge" 
                          className="justify-start text-white data-[state=active]:bg-blue-600 data-[state=active]:text-white"
                        >
                          <BookOpen className="h-4 w-4 mr-2" />
                          K-知识阶段
                        </TabsTrigger>
                        <TabsTrigger 
                          value="wisdom" 
                          className="justify-start text-white data-[state=active]:bg-blue-600 data-[state=active]:text-white"
                        >
                          <Lightbulb className="h-4 w-4 mr-2" />
                          W-智慧阶段
                        </TabsTrigger>
                        <TabsTrigger 
                          value="logic" 
                          className="justify-start text-white data-[state=active]:bg-blue-600 data-[state=active]:text-white"
                        >
                          <LampDesk className="h-4 w-4 mr-2" />
                          L-逻辑阶段
                        </TabsTrigger>
                        <TabsTrigger 
                          value="question" 
                          className="justify-start text-white data-[state=active]:bg-blue-600 data-[state=active]:text-white"
                        >
                          <HelpCircle className="h-4 w-4 mr-2" />
                          Q-提问阶段
                        </TabsTrigger>
                        
                        <Separator className="my-2 bg-neutral-700" />
                        
                        <TabsTrigger 
                          value="style" 
                          className="justify-start text-white data-[state=active]:bg-blue-600 data-[state=active]:text-white"
                        >
                          <Pencil className="h-4 w-4 mr-2" />
                          表达风格
                        </TabsTrigger>
                        <TabsTrigger 
                          value="policy" 
                          className="justify-start text-white data-[state=active]:bg-blue-600 data-[state=active]:text-white"
                        >
                          <Settings className="h-4 w-4 mr-2" />
                          策略约束
                        </TabsTrigger>
                        <TabsTrigger 
                          value="sensitive" 
                          className="justify-start text-white data-[state=active]:bg-blue-600 data-[state=active]:text-white"
                        >
                          <Settings className="h-4 w-4 mr-2" />
                          敏感词列表
                        </TabsTrigger>
                      </TabsList>
                    </Tabs>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="flex justify-between">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const defaultTemplate = getDefaultTemplate(selectedModel);
                    templateContent.setter(defaultTemplate);
                  }}
                  disabled={loading}
                  className="w-full bg-neutral-800 text-white border-neutral-700 hover:bg-neutral-700"
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  重置当前模板
                </Button>
              </CardFooter>
            </Card>
          </div>

          {/* 右侧编辑区 */}
          <div className="lg:col-span-3">
            <Card className="h-full bg-neutral-900 border-neutral-800 flex flex-col">
              <CardHeader className="flex-shrink-0">
                <div className="flex items-center">
                  <div className="text-blue-500 mr-2">
                    {currentTab.icon}
                  </div>
                  <div>
                    <CardTitle className="text-white">{currentTab.title}</CardTitle>
                    <CardDescription className="text-gray-300">{currentTab.description}</CardDescription>
                  </div>
                </div>
                {isEditing && (
                  <div className="text-sm text-green-400 font-medium">
                    该模型已有配置的提示词模板
                  </div>
                )}
              </CardHeader>
              <CardContent className="flex-grow overflow-y-auto overflow-x-hidden -mx-1 px-1" style={{ 
                  maxHeight: "calc(100vh - 250px)", 
                  WebkitOverflowScrolling: "touch",
                  msOverflowStyle: "none",
                  scrollbarWidth: "thin" 
                }}>
                <div className="bg-neutral-800 border border-neutral-700 p-3 rounded-md mb-3 text-sm text-white">
                  <p className="text-gray-200">提示词支持以下变量：</p>
                  <div className="grid grid-cols-2 gap-2 mt-1">
                    <code className="bg-neutral-700 px-1 rounded text-xs text-blue-300">{"{{user_input}}"}</code>
                    <span className="text-gray-300">用户输入</span>
                    <code className="bg-neutral-700 px-1 rounded text-xs text-blue-300">{"{{memory}}"}</code>
                    <span className="text-gray-300">记忆上下文</span>
                    <code className="bg-neutral-700 px-1 rounded text-xs text-blue-300">{"{{search}}"}</code>
                    <span className="text-gray-300">搜索结果</span>
                    <code className="bg-neutral-700 px-1 rounded text-xs text-blue-300">{"{{date}}"}</code>
                    <span className="text-gray-300">当前日期</span>
                  </div>
                </div>
                
                <div className="overflow-auto -mx-1 px-1" style={{ WebkitOverflowScrolling: "touch" }}>
                  <Textarea
                    value={templateContent.value}
                    onChange={(e) => templateContent.setter(e.target.value)}
                    placeholder={templateContent.placeholder}
                    className="min-h-[250px] w-full font-mono text-sm bg-neutral-800 border-neutral-700 text-white placeholder:text-gray-500"
                    disabled={loading}
                    style={{ 
                      WebkitOverflowScrolling: "touch",
                      touchAction: "pan-y",
                      overscrollBehavior: "contain"
                    }}
                  />
                </div>
              </CardContent>
              <CardFooter className="flex justify-between">
                <div className="flex space-x-2">
                  <Button
                    variant="outline"
                    onClick={() => navigate('/admin')}
                    className="bg-neutral-800 text-white border-neutral-700 hover:bg-neutral-700"
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    返回
                  </Button>
                  
                  {isEditing && (
                    <Button
                      variant="destructive"
                      onClick={deleteTemplate}
                      disabled={loading || deleteLoading}
                      className="bg-red-600 hover:bg-red-700"
                    >
                      {deleteLoading ? "删除中..." : "删除模板"}
                      <Trash className="ml-2 h-4 w-4" />
                    </Button>
                  )}
                </div>
                
                <Button
                  onClick={saveTemplate}
                  disabled={loading || saveLoading || (!baseTemplate && !promptTemplate)}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {saveLoading ? "保存中..." : (isEditing ? "更新模板" : "创建模板")}
                  <Save className="ml-2 h-4 w-4" />
                </Button>
              </CardFooter>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PromptEditorPage;