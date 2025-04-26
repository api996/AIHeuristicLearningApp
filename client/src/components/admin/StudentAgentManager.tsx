import React, { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { apiRequest, queryClient } from '@/lib/queryClient';

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Loader2, PlusCircle, RefreshCw, CheckCircle, User } from 'lucide-react';

// 学生智能体预设类型
type StudentAgentPreset = {
  id: number;
  name: string;
  description: string;
  subject: string;
  gradeLevel: string;
  cognitiveLevel: string;
  motivationLevel: string;
  learningStyle: string;
  personalityTrait: string;
  systemPrompt: string;
  kwlqTemplate: {
    K: string[];
    W: string[];
    L: string[];
    Q: string[];
  };
  challengeAreas: string;
  commonMisconceptions: string[];
  createdAt: string;
  updatedAt: string;
  isActive: boolean;
};

// 学生智能体会话类型
type StudentAgentSession = {
  id: number;
  userId: number;
  presetId: number;
  name: string;
  learningTopic: string;
  currentState: any;
  motivationLevel: number;
  confusionLevel: number;
  completedObjectives: any[];
  createdAt: string;
  lastInteractionAt: string;
  isActive: boolean;
};

// 表单验证Schema
const presetFormSchema = z.object({
  name: z.string().min(2, { message: '名称至少需要2个字符' }).max(100),
  description: z.string().optional(),
  subject: z.string().min(1, { message: '请选择一个学科' }),
  gradeLevel: z.string().min(1, { message: '请选择一个年级' }),
  cognitiveLevel: z.string().min(1, { message: '请选择认知水平' }),
  motivationLevel: z.string().min(1, { message: '请选择动机水平' }),
  learningStyle: z.string().min(1, { message: '请选择学习风格' }),
  personalityTrait: z.string().min(1, { message: '请选择性格特征' }),
  challengeAreas: z.string().optional(),
  commonMisconceptions: z.string().optional(),
});

// API 提交的数据类型，解决commonMisconceptions类型不匹配问题
interface ApiSubmitData {
  name: string;
  description?: string;
  subject: string;
  gradeLevel: string;
  cognitiveLevel: string;
  motivationLevel: string;
  learningStyle: string;
  personalityTrait: string;
  challengeAreas?: string;
  commonMisconceptions: string[]; // API需要字符串数组
  userId: number;
}

type PresetFormValues = z.infer<typeof presetFormSchema>;

const StudentAgentManager: React.FC<{ userId: number }> = ({ userId }) => {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('presets');

  // 定义响应类型
  interface PresetsResponse {
    presets: StudentAgentPreset[];
  }

  // 获取预设列表
  const {
    data: presets,
    isLoading: isLoadingPresets,
    error: presetsError,
    refetch: refetchPresets
  } = useQuery<PresetsResponse>({
    queryKey: [`/api/student-agent/presets?userId=${userId}`],
  });

  // 创建预设的Mutation
  const createPresetMutation = useMutation({
    mutationFn: (presetData: ApiSubmitData) => {
      // 直接使用正确类型的数据
      return apiRequest('POST', '/api/student-agent/presets', presetData);
    },
    onSuccess: () => {
      toast({
        title: '成功创建预设',
        description: '学生智能体预设已成功创建',
      });
      queryClient.invalidateQueries({ queryKey: [`/api/student-agent/presets?userId=${userId}`] });
      form.reset();
    },
    onError: (error) => {
      toast({
        title: '创建预设失败',
        description: error instanceof Error ? error.message : '未知错误',
        variant: 'destructive',
      });
    }
  });

  // 表单设置
  const form = useForm<PresetFormValues>({
    resolver: zodResolver(presetFormSchema),
    defaultValues: {
      name: '',
      description: '',
      subject: '中文',
      gradeLevel: '高中一年级', // 修正默认值
      cognitiveLevel: 'medium',
      motivationLevel: 'medium',
      learningStyle: 'visual',
      personalityTrait: 'balanced',
      challengeAreas: '',
      commonMisconceptions: '',
    },
  });

  // 提交表单
  const onSubmit = (data: PresetFormValues) => {
    // 处理commonMisconceptions，将其转换为数组
    const misconceptions = data.commonMisconceptions 
      ? data.commonMisconceptions.split('\n').filter(m => m.trim().length > 0) 
      : [];
    
    // 创建符合API要求的数据对象
    const apiData: ApiSubmitData = {
      ...data,
      commonMisconceptions: misconceptions,
      userId
    };

    createPresetMutation.mutate(apiData);
  };

  return (
    <div className="w-full max-w-full sm:container sm:mx-auto px-2 sm:px-4 py-4 sm:py-6">
      <h1 className="text-2xl sm:text-3xl font-bold mb-4 sm:mb-6">学生智能体管理</h1>
      <p className="text-gray-500 mb-4 sm:mb-8 text-sm sm:text-base">
        创建和管理虚拟学生智能体，以模拟真实的学习行为和提问模式。使用这些智能体可以测试和改进导师系统的教学能力和适应性。
      </p>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="presets">预设管理</TabsTrigger>
          <TabsTrigger value="sessions">会话历史</TabsTrigger>
        </TabsList>

        <TabsContent value="presets" className="space-y-4 sm:space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 w-full">
            {/* 预设列表 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex justify-between items-center text-lg sm:text-xl">
                  <span>现有预设</span>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => refetchPresets()}
                    disabled={isLoadingPresets}
                  >
                    {isLoadingPresets ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                  </Button>
                </CardTitle>
                <CardDescription className="text-sm">
                  已创建的学生智能体预设配置
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingPresets ? (
                  <div className="flex justify-center py-6">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : presetsError ? (
                  <div className="text-center py-6 text-red-500">
                    加载预设时出错
                  </div>
                ) : !presets || !Array.isArray(presets.presets) || presets.presets.length === 0 ? (
                  <div className="text-center py-6 text-gray-500">
                    尚未创建任何预设
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>名称</TableHead>
                        <TableHead>学科</TableHead>
                        <TableHead>年级</TableHead>
                        <TableHead>状态</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {presets.presets.map((preset: StudentAgentPreset) => (
                        <TableRow key={preset.id}>
                          <TableCell className="font-medium">{preset.name}</TableCell>
                          <TableCell>{preset.subject}</TableCell>
                          <TableCell>{preset.gradeLevel}</TableCell>
                          <TableCell>
                            {preset.isActive ? (
                              <CheckCircle className="h-5 w-5 text-green-500" />
                            ) : (
                              <span className="text-gray-400">已停用</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            {/* 创建预设表单 */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg sm:text-xl">创建新预设</CardTitle>
                <CardDescription className="text-sm">
                  创建新的学生智能体预设配置
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm">预设名称</FormLabel>
                          <FormControl>
                            <Input placeholder="如：高中语文学生" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>描述</FormLabel>
                          <FormControl>
                            <Textarea placeholder="预设描述（可选）" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="grid grid-cols-1 xs:grid-cols-2 gap-3 sm:gap-4">
                      <FormField
                        control={form.control}
                        name="subject"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>学科</FormLabel>
                            <Select 
                              onValueChange={field.onChange} 
                              defaultValue={field.value}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="选择学科" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="中文">中文</SelectItem>
                                <SelectItem value="英语">英语</SelectItem>
                                <SelectItem value="数学">数学</SelectItem>
                                <SelectItem value="物理">物理</SelectItem>
                                <SelectItem value="化学">化学</SelectItem>
                                <SelectItem value="生物">生物</SelectItem>
                                <SelectItem value="历史">历史</SelectItem>
                                <SelectItem value="地理">地理</SelectItem>
                                <SelectItem value="政治">政治</SelectItem>
                                <SelectItem value="综合">综合</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="gradeLevel"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>年级</FormLabel>
                            <Select 
                              onValueChange={field.onChange} 
                              defaultValue={field.value}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="选择年级" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="初中一年级">初中一年级</SelectItem>
                                <SelectItem value="初中二年级">初中二年级</SelectItem>
                                <SelectItem value="初中三年级">初中三年级</SelectItem>
                                <SelectItem value="高中一年级">高中一年级</SelectItem>
                                <SelectItem value="高中二年级">高中二年级</SelectItem>
                                <SelectItem value="高中三年级">高中三年级</SelectItem>
                                <SelectItem value="大学">大学</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid grid-cols-1 xs:grid-cols-2 gap-3 sm:gap-4">
                      <FormField
                        control={form.control}
                        name="cognitiveLevel"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>认知水平</FormLabel>
                            <Select 
                              onValueChange={field.onChange} 
                              defaultValue={field.value}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="选择认知水平" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="low">低 - 经常遇到困难</SelectItem>
                                <SelectItem value="medium">中等 - 一般理解能力</SelectItem>
                                <SelectItem value="high">高 - 理解能力强</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="motivationLevel"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>动机水平</FormLabel>
                            <Select 
                              onValueChange={field.onChange} 
                              defaultValue={field.value}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="选择动机水平" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="low">低 - 容易分心</SelectItem>
                                <SelectItem value="medium">中等 - 一般专注度</SelectItem>
                                <SelectItem value="high">高 - 高度专注</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid grid-cols-1 xs:grid-cols-2 gap-3 sm:gap-4">
                      <FormField
                        control={form.control}
                        name="learningStyle"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>学习风格</FormLabel>
                            <Select 
                              onValueChange={field.onChange} 
                              defaultValue={field.value}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="选择学习风格" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="visual">视觉型 - 偏好图表和图像</SelectItem>
                                <SelectItem value="auditory">听觉型 - 偏好语音解释</SelectItem>
                                <SelectItem value="reading">阅读型 - 偏好文本资料</SelectItem>
                                <SelectItem value="kinesthetic">动觉型 - 偏好实践活动</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="personalityTrait"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>性格特征</FormLabel>
                            <Select 
                              onValueChange={field.onChange} 
                              defaultValue={field.value}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="选择性格特征" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="inquisitive">好奇型 - 经常提问</SelectItem>
                                <SelectItem value="reserved">内敛型 - 较少提问</SelectItem>
                                <SelectItem value="logical">逻辑型 - 关注细节</SelectItem>
                                <SelectItem value="creative">创造型 - 尝试创新思路</SelectItem>
                                <SelectItem value="balanced">平衡型 - 均衡表现</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={form.control}
                      name="challengeAreas"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>挑战领域</FormLabel>
                          <FormControl>
                            <Textarea 
                              placeholder="学生面临的特定挑战（可选）" 
                              {...field} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="commonMisconceptions"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>常见误解</FormLabel>
                          <FormControl>
                            <Textarea 
                              placeholder="每行一个常见误解（可选）" 
                              {...field} 
                            />
                          </FormControl>
                          <FormDescription className="text-xs sm:text-sm">
                            每行输入一个常见的学科误解，系统将把它们转换为列表。
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <Button 
                      type="submit" 
                      className="w-full"
                      disabled={createPresetMutation.isPending}
                    >
                      {createPresetMutation.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          创建中...
                        </>
                      ) : (
                        <>
                          <PlusCircle className="mr-2 h-4 w-4" />
                          创建预设
                        </>
                      )}
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="sessions" className="space-y-4 sm:space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg sm:text-xl">学生智能体会话</CardTitle>
              <CardDescription className="text-sm">
                已创建的学生智能体会话记录
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-6 sm:py-10">
                <User className="mx-auto h-8 w-8 sm:h-10 sm:w-10 text-gray-400 mb-3 sm:mb-4" />
                <h3 className="text-base sm:text-lg font-medium">会话功能开发中</h3>
                <p className="text-sm sm:text-base text-gray-500 mt-2">
                  学生智能体会话管理功能正在开发中，敬请期待
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default StudentAgentManager;