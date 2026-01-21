
import React, { useState } from 'react';

interface ImageEditorProps {
  originalImage: string; // The base image to display
  onEdit: (prompt: string) => void;
  isProcessing: boolean;
}

const ImageEditor: React.FC<ImageEditorProps> = ({ originalImage, onEdit, isProcessing }) => {
  const [prompt, setPrompt] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || isProcessing) return;

    onEdit(prompt);
    setPrompt('');
  };

  return (
    <div className="bg-neutral-900 border-t border-neutral-800 flex flex-col h-full relative">
      {/* Editor Controls */}
      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between">
           <span className="text-[10px] text-neutral-600 uppercase font-bold tracking-wider">
              Редактирование образа
           </span>
        </div>

        <form onSubmit={handleSubmit} className="relative">
          <input
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Опишите желаемые изменения..."
            className="w-full bg-black border border-neutral-700 rounded-lg py-3 pl-4 pr-12 text-sm text-white focus:outline-none focus:border-amber-500 transition-all"
            disabled={isProcessing}
          />
          <button
            type="submit"
            disabled={!prompt.trim() || isProcessing}
            className="absolute right-2 top-2 bottom-2 bg-neutral-800 hover:bg-neutral-700 text-white w-8 rounded flex items-center justify-center transition-colors disabled:opacity-50"
          >
            <svg className="w-4 h-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </button>
        </form>
      </div>
    </div>
  );
};

export default ImageEditor;
