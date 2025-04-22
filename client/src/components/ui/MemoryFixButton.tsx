import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import axios from 'axios';
import { Loader2, Sparkles } from 'lucide-react';

interface MemoryFixButtonProps {
  userId: number;
  onComplete?: () => void;
}

const MemoryFixButton: React.FC<MemoryFixButtonProps> = ({ userId, onComplete }) => {
  const [isRepairing, setIsRepairing] = useState(false);
  const { toast } = useToast();

  const handleRepair = async () => {
    if (!userId || isRepairing) return;

    setIsRepairing(true);
    try {
      const response = await axios.get(`/api/repair-memory?userId=${userId}`);
      
      if (response.data.success) {
        toast({
          title: '修复成功',
          description: `成功修复 ${response.data.repairedCount} 条记忆数据`,
          variant: 'default',
        });
        
        if (onComplete) {
          onComplete();
        }
      } else {
        throw new Error(response.data.message || '修复失败');
      }
    } catch (error: any) {
      console.error('记忆修复错误:', error);
      toast({
        title: '修复失败',
        description: error.response?.data?.message || '无法修复记忆数据，请稍后再试',
        variant: 'destructive',
      });
    } finally {
      setIsRepairing(false);
    }
  };

  return (
    <Button 
      onClick={handleRepair}
      disabled={isRepairing}
      className="flex items-center gap-2"
    >
      {isRepairing ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          修复中...
        </>
      ) : (
        <>
          <Sparkles className="h-4 w-4" />
          修复记忆
        </>
      )}
    </Button>
  );
};

export default MemoryFixButton;