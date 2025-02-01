import { useMemo } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import AvatarDisplay, { AvatarStyle } from './ui/avatar-display';

interface AvatarSelectorProps {
  value: string | null;
  onChange: (value: string) => void;
  size?: number;
}

export default function AvatarSelector({ value, onChange, size = 128 }: AvatarSelectorProps) {
  // Parse existing avatar value or create initial one
  const [currentStyle, currentSeed] = useMemo(() => {
    if (!value) {
      return ['lorelei', Math.random().toString(36).substring(7)];
    }
    const [style = 'lorelei', seed] = value.split(':');
    return [style, seed || Math.random().toString(36).substring(7)];
  }, [value]);

  const handleStyleChange = (newStyle: string) => {
    // Keep the same seed when changing styles
    onChange(`${newStyle}:${currentSeed}`);
  };

  const handleRandomize = () => {
    // Only generate new seed when explicitly randomizing
    onChange(`${currentStyle}:${Math.random().toString(36).substring(7)}`);
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <AvatarDisplay 
        avatar={`${currentStyle}:${currentSeed}`}
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
        onClick={handleRandomize}
        className="text-sm text-blue-500 hover:text-blue-600"
      >
        Randomize
      </button>
    </div>
  );
}
