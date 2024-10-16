export const addToScratchPad = (content: string) => {
  const existingContent = localStorage.getItem('scratchPadContent') || '';
  const newContent = existingContent + (existingContent ? '\n\n' : '') + content;
  localStorage.setItem('scratchPadContent', newContent);
  console.log('Scratch Pad content updated:', newContent) // Add this line for debugging
};

export const getScratchPadContent = () => {
  const content = localStorage.getItem('scratchPadContent') || '';
  console.log('Retrieved Scratch Pad content:', content) // Add this line for debugging
  return content;
};

export const setScratchPadContent = (content: string) => {
  localStorage.setItem('scratchPadContent', content);
  console.log('Set Scratch Pad content:', content) // Add this line for debugging
};
