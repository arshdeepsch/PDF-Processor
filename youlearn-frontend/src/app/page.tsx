'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { api, type BoundingBox } from '@/services/api';
import Transcript from '@/components/Transcript';

// Dynamically import PDFViewer to avoid SSR issues
const PDFViewer = dynamic(() => import('@/components/PDFViewer'), {
  ssr: false,
  loading: () => (
    <div className="h-[800px] flex items-center justify-center border border-gray-300 rounded">
      Loading PDF viewer...
    </div>
  ),
});

export default function Home() {
  const [pdfUrl, setPdfUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [boundingBoxes, setBoundingBoxes] = useState<BoundingBox[]>([]);
  const [highlightedText, setHighlightedText] = useState<{ 
    text: string; 
    page: number; 
    bbox: [number, number, number, number];
  }>();
  const [showPdf, setShowPdf] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    
    try {
      const result = await api.extractPDF(pdfUrl);
      setBoundingBoxes(result.pages);
      setShowPdf(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process PDF');
    } finally {
      setIsLoading(false);
    }
  };

  const handleTextClick = (text: string, page: number, bbox: [number, number, number, number]) => {
    setHighlightedText({ text, page, bbox });
  };

  return (
    <div className="min-h-screen p-8">
      <main className="max-w-7xl mx-auto">
        <h1 className="text-2xl font-bold mb-8">PDF Viewer</h1>
        
        <form onSubmit={handleSubmit} className="mb-8">
          <div className="flex gap-4">
            <input
              type="url"
              value={pdfUrl}
              onChange={(e) => setPdfUrl(e.target.value)}
              placeholder="Enter PDF URL"
              className="flex-1 px-4 py-2 border border-gray-300 rounded text-black"
              required
              disabled={isLoading}
            />
            <button
              type="submit"
              className="px-6 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
              disabled={isLoading}
            >
              {isLoading ? 'Processing...' : 'Load PDF'}
            </button>
          </div>
          {error && (
            <p className="mt-2 text-red-500">{error}</p>
          )}
        </form>

        {showPdf && pdfUrl && (
          <div className="grid grid-cols-[2fr,1fr] gap-8">
            <PDFViewer 
              url={pdfUrl}
              boundingBoxes={boundingBoxes}
              onTextClick={handleTextClick}
              highlightedText={highlightedText}
            />
            <Transcript 
              boundingBoxes={boundingBoxes}
              onTextClick={handleTextClick}
              highlightedText={highlightedText}
            />
          </div>
        )}
      </main>
    </div>
  );
}
