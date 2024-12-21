export function isMarkdown(text: string): boolean {
    // This is a simple check and might need to be improved for more accurate detection
    const markdownPatterns = [
      /^#\s/m, // Headers
      /\*\*(.*?)\*\*/m, // Bold
      /\*(.*?)\*/m, // Italic
      /\[(.*?)\]$$(.*?)$$/m, // Links
      /```[\s\S]*?```/m, // Code blocks
      /^\s*[-*+]\s/m, // Unordered lists
      /^\s*\d+\.\s/m, // Ordered lists
    ];
  
    return markdownPatterns.some(pattern => pattern.test(text));
  }
  
  