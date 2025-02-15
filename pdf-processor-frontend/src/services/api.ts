import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export interface BoundingBox {
  text: string;
  bbox: [number, number, number, number];
  page: number;
}

export interface PDFProcessingResponse {
  pages: BoundingBox[];
  error?: string;
}

export const api = {
  async extractPDF(url: string): Promise<PDFProcessingResponse> {
    try {
      const response = await axios.get(`${API_BASE_URL}/extract`, {
        params: { pdf_url: url }
      });
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(error.response?.data?.detail || 'Failed to process PDF');
      }
      throw error;
    }
  }
}; 