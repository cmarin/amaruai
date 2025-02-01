import { useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import { isMarkdown } from '@/app/utils/isMarkdown';
import { cn } from '@/lib/utils';
import AvatarDisplay from './ui/avatar-display';
import { User } from 'lucide-react';

interface ChatMessageProps {
  role: 'user' | 'assistant';
  content: string;
  avatar?: string | null | undefined;
}

export default function ChatMessage({ role, content, avatar }: ChatMessageProps) {
  const isAssistant = role === 'assistant';

  return (
    <div className={cn(
      'mb-4 flex items-start gap-3',
      isAssistant ? 'flex-row' : 'flex-row-reverse'
    )}>
      <div className="flex-shrink-0 mt-1">
        {isAssistant ? (
          <AvatarDisplay
            avatar={avatar || null}
            size={32}
            alt="Assistant"
            className="border border-gray-200"
          />
        ) : (
          <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center">
            <User className="w-5 h-5 text-white" />
          </div>
        )}
      </div>
      <div
        className={cn(
          'max-w-[80%] p-3 rounded-lg',
          isAssistant 
            ? 'bg-gray-100 text-black' 
            : 'bg-blue-500 text-white'
        )}
      >
        {isMarkdown(content) ? (
          <ReactMarkdown>{content}</ReactMarkdown>
        ) : (
          <p>{content}</p>
        )}
      </div>
    </div>
  );
}
