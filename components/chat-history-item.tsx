import * as React from 'react';
import { motion, useMotionValue, useTransform } from 'motion/react';
import { Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Chat } from './dashboard-layout';

interface ChatHistoryItemProps {
  chat: Chat;
  isActive: boolean;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
}

export function ChatHistoryItem({ chat, isActive, onSelect, onDelete }: ChatHistoryItemProps) {
  const x = useMotionValue(0);
  const opacity = useTransform(x, [0, 150], [0, 1]);
  const scale = useTransform(x, [0, 150], [0.5, 1]);
  const [isDeleting, setIsDeleting] = React.useState(false);

  const handleDragEnd = (_: any, info: any) => {
    if (info.offset.x > 150) {
      setIsDeleting(true);
      setTimeout(() => onDelete(chat.id), 300);
    }
  };

  return (
    <div className="relative overflow-hidden rounded-lg">
      <motion.div 
        style={{ opacity, scale }}
        className="absolute inset-0 bg-red-500 flex items-center pl-4 text-white z-0"
      >
        <Trash2 size={16} />
      </motion.div>
      
      <motion.button
        drag="x"
        dragConstraints={{ left: 0, right: 200 }}
        dragElastic={0.1}
        onDragEnd={handleDragEnd}
        style={{ x }}
        onClick={() => onSelect(chat.id)}
        animate={isDeleting ? { x: 400, opacity: 0 } : { x: 0 }}
        className={cn(
          "relative z-10 w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex flex-col gap-0.5 bg-gray-dark",
          isActive ? "bg-electric-blue/10 text-electric-blue font-bold" : "text-muted hover:bg-black-deep/50 hover:text-foreground"
        )}
      >
        <span className="truncate">{chat.title}</span>
        <span className="text-[9px] opacity-50">
          {chat.updatedAt ? new Date(chat.updatedAt).toLocaleDateString() : 'Just now'}
        </span>
      </motion.button>
    </div>
  );
}
