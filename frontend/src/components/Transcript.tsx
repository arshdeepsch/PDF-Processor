import React, { useMemo, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { BoundingBox } from '@/services/api';

interface TranscriptProps {
  boundingBoxes: BoundingBox[];
  onTextClick: (text: string, page: number, bbox: [number, number, number, number]) => void;
  highlightedText?: { 
    text: string; 
    page: number; 
    bbox: [number, number, number, number];
  };
}

export default function Transcript({ boundingBoxes, onTextClick, highlightedText }: TranscriptProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  
  const markdownContent = useMemo(() => {
    const groups = boundingBoxes.reduce((acc, box) => {
      const pageGroup = acc[box.page] || { content: [] };
      
      // Handle different types of text blocks
      if (box.text === "\n") {
        pageGroup.content.push({ type: 'newline', content: '\n' });
      } else if (box.text === "\n\n") {
        pageGroup.content.push({ type: 'newline', content: '\n\n' });
      } else {
        const dataAttr = `${box.text}-${box.bbox.join(',')}-page${box.page}`;
        const isHighlighted = highlightedText?.text === box.text && 
                            highlightedText.page === box.page &&
                            box.bbox.every((val, idx) => Math.abs(val - highlightedText.bbox[idx]) < 0.1);
        
        pageGroup.content.push({
          type: 'text',
          content: box.text,
          dataAttr,
          isHighlighted
        });
      }
      
      acc[box.page] = pageGroup;
      return acc;
    }, {} as Record<number, { content: Array<{ type: string; content: string; dataAttr?: string; isHighlighted?: boolean }> }>);

    return Object.entries(groups)
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([page, { content }]) => ({ 
        page: Number(page), 
        content 
      }));
  }, [boundingBoxes, highlightedText]);

  useEffect(() => {
    if (!highlightedText || !containerRef.current) return;

    const element = containerRef.current.querySelector(
      `[data-text="${highlightedText.text}-${highlightedText.bbox.join(',')}-page${highlightedText.page}"]`
    );

    if (element) {
      requestAnimationFrame(() => {
        element.scrollIntoView({
          behavior: 'smooth',
          block: 'center'
        });
      });
    }
  }, [highlightedText]);

  return (
    <div ref={containerRef} className="p-4 bg-white rounded-lg shadow max-h-[800px] overflow-y-auto">
      <div className="prose prose-sm max-w-none dark:prose-invert font-serif text-sm text-black">
        {markdownContent.map((group) => (
          <div key={group.page} className="mb-8" data-page={group.page}>
            <div className="text-xs text-gray-500 text-right border-b pb-1 mb-4">
              Page {group.page + 1}
            </div>
            <div className="whitespace-pre-wrap">
              {group.content.map((item, idx) => {
                if (item.type === 'newline') {
                  return <React.Fragment key={idx}>{item.content}</React.Fragment>;
                }
                
                return (
                  <span
                    key={idx}
                    data-text={item.dataAttr}
                    onClick={() => {
                      if (item.type === 'text' && item.dataAttr) {
                        const [text, bbox, page] = item.dataAttr.split('-page');
                        const coordinates = bbox.split(',').map(Number) as [number, number, number, number];
                        onTextClick(text, Number(page), coordinates);
                      }
                    }}
                    className={`${
                      item.isHighlighted ? 'bg-yellow-200' : 'hover:bg-gray-100 cursor-pointer'
                    }`}
                  >
                    {item.content}
                  </span>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
} 