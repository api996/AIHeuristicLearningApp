import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, Database, BrainCircuit } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import axios from 'axios';

interface MemoryFixButtonProps {
  userId: number;
  onComplete?: () => void;
}

const MemoryFixButton: React.FC<MemoryFixButtonProps> = ({ userId, onComplete }) => {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleFixMemories = async () => {
    if (!userId) {
      toast({
        title: '错误',
        description: '未指定用户ID',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    try {
      const response = await axios.get(`/api/repair-memory?userId=${userId}`);
      
      if (response.data.success) {
        toast({
          title: '记忆修复完成',
          description: `成功修复${response.data.repairedCount}条记忆数据`,
          variant: 'default',
        });
        
        // 调用完成回调
        if (onComplete) {
          onComplete();
        }
      } else {
        toast({
          title: '修复失败',
          description: response.data.message || '记忆修复失败',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('记忆修复错误:', error);
      toast({
        title: '修复错误',
        description: '处理记忆数据时出错',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button
      onClick={handleFixMemories}
      disabled={isLoading}
      className="flex items-center gap-2 bg-cyan-700 hover:bg-cyan-800"
    >
      {isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Database className="h-4 w-4" />
      )}
      <span>修复记忆数据</span>
    </Button>
  );
};

export default MemoryFixButton;