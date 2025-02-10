// DocumentViewer.tsx
import { useState } from 'react';
import PDFViewer from './PDFViewer';
import Transcript from './Transcript';
import type { BoundingBox } from '@/services/api';

interface HighlightedText {
  text: string;
  page: number;
  bbox: [number, number, number, number];
}

interface DocumentViewerProps {
  url: string;
  boundingBoxes: BoundingBox[];
}

export default function DocumentViewer({ url, boundingBoxes }: DocumentViewerProps) {
  const [highlightedText, setHighlightedText] = useState<HighlightedText | undefined>(undefined);

  // When text is clicked in the PDF or transcript, update the highlighted state.
  const handleTextClick = (text: string, page: number, bbox: [number, number, number, number]) => {
    setHighlightedText({ text, page, bbox });
  };

  return (
    <div className="flex gap-4">
      <div className="w-2/3">
        <PDFViewer
          url={url}
          boundingBoxes={boundingBoxes}
          onTextClick={handleTextClick}
          highlightedText={highlightedText}
        />
      </div>
      <div className="w-1/3">
        <Transcript
          boundingBoxes={boundingBoxes}
          onTextClick={handleTextClick}
          highlightedText={highlightedText}
        />
      </div>
    </div>
  );
}
