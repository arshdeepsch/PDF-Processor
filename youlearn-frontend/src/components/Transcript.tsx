import { useMemo, useRef, useEffect } from 'react';
import { BoundingBox } from '@/services/api';

interface TranscriptProps {
  boundingBoxes: BoundingBox[];
  onTextClick: (text: string) => void;
  highlightedText?: string;
}

interface GroupedText {
  page: number;
  sections: {
    title?: string;
    content: BoundingBox[];
  }[];
}

export default function Transcript({ boundingBoxes, onTextClick, highlightedText }: TranscriptProps) {
  const highlightRef = useRef<HTMLSpanElement>(null);
  
  const groupedTexts = useMemo(() => {
    const groups: GroupedText[] = [];
    
    boundingBoxes.forEach((box) => {
      const pageGroup = groups.find(g => g.page === box.page);
      const isTitle = box.text.length < 100 && (
        /^\d+(\.\d+)*\s+[A-Z]/.test(box.text) || // Numbered sections
        /^[A-Z][a-zA-Z\s]{0,50}$/.test(box.text) // Short uppercase titles
      );
      
      if (pageGroup) {
        if (isTitle) {
          pageGroup.sections.push({ title: box.text, content: [] });
        } else {
          if (pageGroup.sections.length === 0) {
            pageGroup.sections.push({ content: [] });
          }
          pageGroup.sections[pageGroup.sections.length - 1].content.push(box);
        }
      } else {
        const sections = isTitle 
          ? [{ title: box.text, content: [] }]
          : [{ content: [box] }];
        groups.push({ page: box.page, sections });
      }
    });
    
    return groups.sort((a, b) => a.page - b.page);
  }, [boundingBoxes]);

  useEffect(() => {
    if (highlightedText && highlightRef.current) {
      highlightRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [highlightedText]);

  return (
    <div className="p-4 bg-white rounded-lg shadow max-h-[800px] overflow-y-auto">
      <div className="space-y-8 text-sm text-black font-serif leading-relaxed">
        {groupedTexts.map((group) => (
          <div key={group.page} className="space-y-6">
            <div className="text-xs text-gray-500 text-right border-b pb-1">
              {group.page + 1}
            </div>
            {group.sections.map((section, sectionIndex) => (
              <div key={sectionIndex} className="space-y-3">
                {section.title && (
                  <h4 className="font-bold text-sm">{section.title}</h4>
                )}
                <div className="space-y-4">
                  {section.content.map((box, index) => (
                    <span
                      key={index}
                      ref={box.text === highlightedText ? highlightRef : null}
                      className={`inline ${
                        box.text === highlightedText
                          ? 'bg-yellow-100'
                          : 'hover:bg-gray-50'
                      } cursor-pointer`}
                      onClick={() => onTextClick(box.text)}
                    >
                      {box.text}{' '}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
} 