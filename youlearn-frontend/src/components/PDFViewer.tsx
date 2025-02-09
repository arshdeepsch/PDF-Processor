import { useState, useRef, useEffect } from 'react';
import { Worker, Viewer, SpecialZoomLevel, Position, Plugin, ViewerState } from '@react-pdf-viewer/core';
import { defaultLayoutPlugin } from '@react-pdf-viewer/default-layout';
import type { BoundingBox } from '@/services/api';

// Import styles
import '@react-pdf-viewer/core/lib/styles/index.css';
import '@react-pdf-viewer/default-layout/lib/styles/index.css';

interface PDFViewerProps {
  url: string;
  boundingBoxes: BoundingBox[];
  onTextClick?: (text: string) => void;
  highlightedText?: string;
}

export default function PDFViewer({ url, boundingBoxes, onTextClick, highlightedText }: PDFViewerProps) {
  const [scale, setScale] = useState(1);
  const [currentPage, setCurrentPage] = useState(0);
  
  const defaultLayoutPluginInstance = defaultLayoutPlugin();
  
  const trackingPlugin = {
    install: (pluginFunctions: any) => {
      pluginFunctions.onZoom = (e: any) => setScale(e.scale);
      pluginFunctions.onDocumentLoad = (e: any) => setCurrentPage(e.doc.numPages);
    },
  };

  const renderHighlights = (props: any) => {
    const { pageIndex, rotation, scale: currentScale } = props;

    return (
      <>
        {boundingBoxes
          .filter(box => box.page === pageIndex && box.text === highlightedText)
          .map((box, index) => {
            const [x, y, width, height] = box.bbox;
            return (
              <div
                key={index}
                style={{
                  position: 'absolute',
                  left: x * currentScale,
                  top: y * currentScale,
                  width: (width - x) * currentScale,
                  height: (height - y) * currentScale,
                  backgroundColor: 'rgba(255, 255, 0, 0.3)',
                  cursor: 'pointer',
                  pointerEvents: 'all',
                  zIndex: 1,
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  onTextClick?.(box.text);
                }}
              />
            );
          })}
      </>
    );
  };

  return (
    <div className="h-[800px] border border-gray-300 rounded">
      <Worker workerUrl="https://unpkg.com/pdfjs-dist@3.4.120/build/pdf.worker.min.js">
        <Viewer
          fileUrl={url}
          plugins={[defaultLayoutPluginInstance, trackingPlugin]}
          defaultScale={SpecialZoomLevel.PageFit}
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