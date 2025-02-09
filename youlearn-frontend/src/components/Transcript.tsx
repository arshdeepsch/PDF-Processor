import { useMemo, useRef, useEffect } from 'react';
import { BoundingBox } from '@/services/api';

interface TranscriptProps {
  boundingBoxes: BoundingBox[];
  onTextClick: (text: string) => void;
  highlightedText?: string;
}

interface GroupedText {
  page: number;
  texts: BoundingBox[];
}

export default function Transcript({ boundingBoxes, onTextClick, highlightedText }: TranscriptProps) {
  const highlightRef = useRef<HTMLSpanElement>(null);
  
  const groupedTexts = useMemo(() => {
    const groups: GroupedText[] = [];
    boundingBoxes.forEach((box) => {
      const pageGroup = groups.find(g => g.page === box.page);
      if (pageGroup) {
        pageGroup.texts.push(box);
      } else {
        groups.push({ page: box.page, texts: [box] });
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
    <div className="p-4 bg-white rounded-lg shadow max-h-[800px] overflow-y-auto text-black text-sm">
      <h2 className="text-xl font-bold mb-4">Transcript</h2>
      <div className="space-y-6">
        {groupedTexts.map((group) => (
          <div key={group.page} className="space-y-2">
            <h3 className="text-lg font-semibold text-gray-700">
              Page {group.page + 1}
            </h3>
            <div className="pl-4 border-l-2 border-gray-200">
              {group.texts.map((box, index) => (
                <span
                  key={index}
                  ref={box.text === highlightedText ? highlightRef : null}
                  className={`inline ${
                    box.text === highlightedText
                      ? 'bg-yellow-100'
                      : 'hover:bg-gray-100'
                  } cursor-pointer rounded px-1`}
                  onClick={() => onTextClick(box.text)}
                >
                  {box.text}{' '}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
} 