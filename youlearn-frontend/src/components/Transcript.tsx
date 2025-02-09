import { useMemo, useRef, useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { BoundingBox } from '@/services/api';
import type { ReactNode } from 'react';

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
  const highlightRef = useRef<HTMLSpanElement>(null);
  const [currentPage, setCurrentPage] = useState(0);
  
  const markdownContent = useMemo(() => {
    const groups = boundingBoxes.reduce((acc, box) => {
      const pageGroup = acc[box.page] || { sections: [] };
      
      // Detect different types of headings
      const isChapter = /^Chapter\s+\d+:?\s+/i.test(box.text);
      const isSection = /^\d+\.\d+\s+[A-Z]/i.test(box.text);
      const isSubSection = /^\d+\.\d+\.\d+\s+[A-Z]/i.test(box.text);
      
      if (isChapter) {
        pageGroup.sections.push({ type: 'heading', level: 1, box });
      } else if (isSection) {
        pageGroup.sections.push({ type: 'heading', level: 2, box });
      } else if (isSubSection) {
        pageGroup.sections.push({ type: 'heading', level: 3, box });
      } else {
        if (pageGroup.sections.length === 0 || pageGroup.sections[pageGroup.sections.length - 1].type === 'heading') {
          pageGroup.sections.push({ type: 'paragraph', boxes: [] });
        }
        if (pageGroup.sections[pageGroup.sections.length - 1].type === 'paragraph') {
          pageGroup.sections[pageGroup.sections.length - 1].boxes.push(box);
        }
      }
      
      acc[box.page] = pageGroup;
      return acc;
    }, {} as Record<number, { sections: any[] }>);

    return Object.entries(groups)
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([page, { sections }]) => ({ page: Number(page), sections }));
  }, [boundingBoxes]);

  useEffect(() => {
    if (highlightedText) {
      const encodedText = encodeURIComponent(`${highlightedText.text}-${highlightedText.bbox.join(',')}-page${highlightedText.page}`);
      const element = document.querySelector(`[data-text="${encodedText}"]`);
      if (element) {
        const container = element.closest('.overflow-y-auto');
        if (container) {
          const elementRect = element.getBoundingClientRect();
          const containerRect = container.getBoundingClientRect();
          const isInView = (
            elementRect.top >= containerRect.top &&
            elementRect.bottom <= containerRect.bottom
          );
          
          if (!isInView) {
            element.scrollIntoView({ 
              behavior: 'smooth', 
              block: 'nearest'
            });
          }
        }
      }
    }
  }, [highlightedText]);

  return (
    <div className="p-4 bg-white rounded-lg shadow max-h-[800px] overflow-y-auto">
      <div className="prose prose-sm max-w-none dark:prose-invert font-serif text-sm text-black">
        {markdownContent.map((group) => (
          <div key={group.page} className="mb-8">
            <div className="text-xs text-gray-500 text-right border-b pb-1 mb-4">
              Page {group.page + 1}
            </div>
            {group.sections.map((section, idx) => {
              if (section.type === 'heading') {
                const Component = `h${section.level}` as 'h1' | 'h2' | 'h3';
                return (
                  <Component key={idx} className="font-bold my-4">
                    {section.box.text}
                  </Component>
                );
              } else {
                return (
                  <p key={idx} className="my-3">
                    {section.boxes.map((box: BoundingBox, textIdx: number) => {
                      const isHighlighted = highlightedText?.text === box.text && 
                                          highlightedText?.page === box.page &&
                                          box.bbox.every((val, idx) => Math.abs(val - highlightedText.bbox[idx]) < 0.1);
                      return (
                        <span
                          key={`${box.text}-${box.page}-${box.bbox.join(',')}`}
                          onClick={() => onTextClick(box.text, box.page, box.bbox)}
                          className={`cursor-pointer ${
                            isHighlighted ? 'bg-yellow-100' : 'hover:bg-gray-50'
                          }`}
                          data-text={`${box.text}-${box.bbox.join(',')}-page${box.page}`}
                        >
                          {box.text}{' '}
                        </span>
                      );
                    })}
                  </p>
                );
              }
            })}
          </div>
        ))}
      </div>
    </div>
  );
} 