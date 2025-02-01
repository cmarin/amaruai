import { useMemo } from 'react';
import { createAvatar } from '@dicebear/core';
import * as lorelei from '@dicebear/lorelei';
import * as bottts from '@dicebear/bottts';
import * as adventurer from '@dicebear/adventurer';
import { cn } from '@/lib/utils';

const avatarGenerators = {
  lorelei: (seed: string, size: number) => createAvatar(lorelei, { seed, size }).toDataUri(),
  bottts: (seed: string, size: number) => createAvatar(bottts, { seed, size }).toDataUri(),
  adventurer: (seed: string, size: number) => createAvatar(adventurer, { seed, size }).toDataUri()
} as const;

export type AvatarStyle = keyof typeof avatarGenerators;

interface AvatarDisplayProps extends React.HTMLAttributes<HTMLImageElement> {
  /**
   * Avatar string in format "style:seed" (e.g., "lorelei:abc123")
   * If not provided, a default avatar will be generated
   */
  avatar: string | null;
  /** Size in pixels (both width and height) */
  size?: number;
  /** Optional CSS class name */
  className?: string;
  /** Optional alt text for the image */
  alt?: string;
}

export default function AvatarDisplay({ 
  avatar, 
  size = 40, 
  className,
  alt = "Avatar",
  ...props 
}: AvatarDisplayProps) {
  const [style = 'lorelei', seed = Math.random().toString(36).substring(7)] = 
    (avatar?.split(':') || []) as [AvatarStyle?, string?];

  const avatarUrl = useMemo(() => {
    const generator = avatarGenerators[style as AvatarStyle] || avatarGenerators.lorelei;
    return generator(seed, size);
  }, [style, seed, size]);

  return (
    <img
      src={avatarUrl}
      alt={alt}
      width={size}
      height={size}
      className={cn(
        "rounded-full border-2 border-gray-200",
        className
      )}
      {...props}
    />
  );
}
