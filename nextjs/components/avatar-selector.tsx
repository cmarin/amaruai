import { useMemo } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import AvatarDisplay, { AvatarStyle } from './ui/avatar-display';

interface AvatarSelectorProps {
  value: string | null;
  onChange: (value: string) => void;
  size?: number;
}

export default function AvatarSelector({ value, onChange, size = 128 }: AvatarSelectorProps) {
  const seed = useMemo(() => value?.split(':')[1] || Math.random().toString(36).substring(7), [value]);
  const currentStyle = value?.split(':')[0] as AvatarStyle || 'lorelei';

  const handleStyleChange = (newStyle: string) => {
    onChange(`${newStyle}:${seed}`);
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <AvatarDisplay 
        avatar={value} 
        size={size}
      />
      <Select value={currentStyle} onValueChange={handleStyleChange}>
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Select style" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="lorelei">Lorelei</SelectItem>
          <SelectItem value="bottts">Bottts</SelectItem>
          <SelectItem value="adventurer">Adventurer</SelectItem>
        </SelectContent>
      </Select>
      <button
        onClick={() => onChange(`${currentStyle}:${Math.random().toString(36).substring(7)}`)}
        className="text-sm text-blue-500 hover:text-blue-600"
      >
        Randomize
      </button>
    </div>
  );
}
