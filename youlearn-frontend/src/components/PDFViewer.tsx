import { useState, useEffect, useRef } from 'react';
import { Worker, Viewer, SpecialZoomLevel } from '@react-pdf-viewer/core';
import { defaultLayoutPlugin } from '@react-pdf-viewer/default-layout';
import type { BoundingBox } from '@/services/api';

// Import styles
import '@react-pdf-viewer/core/lib/styles/index.css';
import '@react-pdf-viewer/default-layout/lib/styles/index.css';

interface PDFViewerProps {
  url: string;
  boundingBoxes: BoundingBox[];
  onTextClick: (text: string, page: number, bbox: [number, number, number, number]) => void;
  highlightedText?: { 
    text: string; 
    page: number; 
    bbox: [number, number, number, number];
  };
}

export default function PDFViewer({ url, boundingBoxes, onTextClick, highlightedText }: PDFViewerProps) {
  const [scale, setScale] = useState(1);
  const [currentPage, setCurrentPage] = useState(0);
  const highlightRefs = useRef<(HTMLDivElement | null)[]>([]);
  
  const defaultLayoutPluginInstance = defaultLayoutPlugin();

  useEffect(() => {
    if (highlightedText) {
      const highlightElement = highlightRefs.current.find(ref => ref !== null);
      highlightElement?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [highlightedText]);

  const renderHighlights = (props: any) => {
    const { pageIndex, scale: currentScale } = props;
    highlightRefs.current = [];

    return (
      <>
        {boundingBoxes
          .filter(box => box.page === pageIndex)
          .map((box, index) => {
            const [x, y, width, height] = box.bbox;
            const isHighlighted = highlightedText?.text === box.text && 
                                highlightedText?.page === box.page &&
                                box.bbox.every((val, idx) => Math.abs(val - highlightedText.bbox[idx]) < 0.1);
            
            return (
              <div
                key={`${box.text}-${box.page}-${box.bbox.join(',')}`}
                ref={el => {
                  if (isHighlighted) {
                    highlightRefs.current.push(el);
                  }
                }}
                style={{
                  position: 'absolute',
                  left: x * currentScale,
                  top: y * currentScale,
                  width: (width - x) * currentScale,
                  height: (height - y) * currentScale,
                  backgroundColor: isHighlighted ? 'rgba(255, 255, 0, 0.3)' : 'rgba(0, 0, 0, 0)',
                  cursor: 'pointer',
                  pointerEvents: 'all',
                  zIndex: 1,
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  onTextClick(box.text, box.page, box.bbox);
                  
                  // Give React time to update the state and find the element
                  setTimeout(() => {
                    const dataText = `${box.text}-${box.bbox.join(',')}-page${box.page}`;
                    const transcriptElement = document.querySelector(`[data-text="${dataText}"]`);
                    const container = document.querySelector('.overflow-y-auto');
                    
                    if (transcriptElement && container) {
                      const elementRect = transcriptElement.getBoundingClientRect();
                      const containerRect = container.getBoundingClientRect();
                      
                      // Check if element is not in view
                      if (elementRect.top < containerRect.top || elementRect.bottom > containerRect.bottom) {
                        transcriptElement.scrollIntoView({
                          behavior: 'smooth',
                          block: 'center'
                        });
                      }
                    }
                  }, 100);
                }}
              />
            );
          })}
      </>
    );
  };

  return (
    <div className="h-[800px] border border-gray-300 rounded">
      <Worker workerUrl={`https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js`}>
        <Viewer
          fileUrl={url}
          plugins={[defaultLayoutPluginInstance]}
          defaultScale={SpecialZoomLevel.PageFit}
          onPageChange={(page) => setCurrentPage(page.currentPage)}
          renderPage={(props) => (
            <>
              {props.canvasLayer.children}
              {props.textLayer.children}
              {renderHighlights(props)}
            </>
          )}
        />
      </Worker>
    </div>
  );
} 