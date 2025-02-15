import { useMemo, useRef, useEffect } from 'react';
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

interface Section {
  type: 'heading' | 'paragraph';
  level?: 1 | 2 | 3;
  box?: BoundingBox;
  boxes?: BoundingBox[];
}

interface PageGroup {
  sections: Section[];
}

export default function Transcript({ boundingBoxes, onTextClick, highlightedText }: TranscriptProps) {
  const highlightRef = useRef<HTMLSpanElement>(null);
  
  const markdownContent = useMemo(() => {
    const groups = boundingBoxes.reduce((acc, box) => {
      const pageGroup = acc[box.page] || { sections: [] };
      
      // Handle special cases
      if (box.text === "\n") {
        if (pageGroup.sections.length > 0 && 
            pageGroup.sections[pageGroup.sections.length - 1]?.type === 'paragraph' &&
            pageGroup.sections[pageGroup.sections.length - 1]?.boxes) {
          const lastSection = pageGroup.sections[pageGroup.sections.length - 1];
          if (lastSection && lastSection.boxes) {
            lastSection.boxes.push(box);
          }
        }
        acc[box.page] = pageGroup;
        return acc;
      }
      
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
        const lastSection = pageGroup.sections[pageGroup.sections.length - 1];
        if (lastSection?.type === 'paragraph' && lastSection?.boxes) {
          lastSection?.boxes.push(box);
        }
      }
      
      acc[box.page] = pageGroup;
      return acc;
    }, {} as Record<number, PageGroup>);

    return Object.entries(groups)
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([page, { sections }]) => ({ page: Number(page), sections }));
  }, [boundingBoxes]);

  useEffect(() => {
    if (highlightedText) {
      const encodedText = encodeURIComponent(`${highlightedText.text}-${highlightedText.bbox.join(',')}-page${highlightedText.page}`);
      const element = document.querySelector(`[data-text="${encodedText}"]`);
      if (element) {
        // First scroll the page section into view
        const pageSection = element.closest(`[data-page="${highlightedText.page}"]`);
        if (pageSection) {
          pageSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
          
          // Then scroll to the specific text after a small delay
          setTimeout(() => {
            element.scrollIntoView({ 
              behavior: 'smooth', 
              block: 'center'
            });
          }, 100);
        }
      }
    }
  }, [highlightedText]);

  return (
    <div className="p-4 bg-white rounded-lg shadow max-h-[800px] overflow-y-auto">
      <div className="prose prose-sm max-w-none dark:prose-invert font-serif text-sm text-black">
        {markdownContent.map((group) => (
          <div key={group.page} className="mb-8" data-page={group.page}>
            <div className="text-xs text-gray-500 text-right border-b pb-1 mb-4">
              Page {group.page + 1}
            </div>
            {group.sections.map((section, idx) => {
              if (section.type === 'heading') {
                const Component = `h${section.level}` as 'h1' | 'h2' | 'h3';
                return (
                  <Component key={idx} className="font-bold my-4">
                    {section.box?.text}
                  </Component>
                );
              } else {
                return (
                  <p key={idx} className="my-3 whitespace-pre-wrap">
                    {section.boxes?.map((box: BoundingBox, textIdx: number) => {
                      const key = `${box.text}-${box.page}-${box.bbox.join(',')}-${textIdx}`;
                      
                      if (box.text === "\n") {
                        return <br key={key} />;
                      }
                      
                      const isHighlighted = highlightedText?.text === box.text && 
                                          highlightedText?.page === box.page &&
                                          box.bbox.every((val, idx) => Math.abs(val - highlightedText.bbox[idx]) < 0.1);
                      
                      return (
                        <span
                          key={key}
                          onClick={() => onTextClick(box.text, box.page, box.bbox)}
                          className={`cursor-pointer ${
                            isHighlighted ? 'bg-yellow-100' : 'hover:bg-gray-50'
                          }`}
                          data-text={`${box.text}-${box.bbox.join(',')}-page${box.page}`}
                          ref={isHighlighted ? highlightRef : undefined}
                        >
                          {box.text}
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