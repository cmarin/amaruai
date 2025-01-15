declare module 'react-file-icon' {
  export interface FileIconProps {
    extension?: string;
    type?: string;
    size?: number;
    color?: string;
    gradientOpacity?: number;
    glyphColor?: string;
    labelColor?: string;
    labelTextColor?: string;
    labelUppercase?: boolean;
    foldColor?: string;
    radius?: number;
  }

  export const FileIcon: React.FC<FileIconProps>;
  export const defaultStyles: {
    [key: string]: {
      color?: string;
      gradientOpacity?: number;
      glyphColor?: string;
      labelColor?: string;
      labelTextColor?: string;
      labelUppercase?: boolean;
      foldColor?: string;
    };
  };
} 