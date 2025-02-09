from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, HttpUrl
import fitz  # PyMuPDF
import requests
import tempfile
import pytesseract
from PIL import Image
import io
import os
from typing import List, Dict, Union
import logging

app = FastAPI()

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class BoundingBox(BaseModel):
    text: str
    bbox: List[float]
    page: int

class PDFResponse(BaseModel):
    pages: List[BoundingBox]
    error: str = None

def download_pdf(url: str) -> bytes:
    """Download PDF from URL with size validation"""
    response = requests.get(url, stream=True)
    response.raise_for_status()
    
    # Check file size (50MB limit)
    content_length = int(response.headers.get('content-length', 0))
    if content_length > 50 * 1024 * 1024:  # 50MB in bytes
        raise HTTPException(status_code=400, detail="PDF file too large (max 50MB)")
    
    return response.content

def process_text_blocks(page, page_num) -> List[Dict]:
    """Process text blocks with accurate bounding boxes"""
    blocks = []
    text_page = page.get_text("dict", sort=True)
    
    for block in text_page["blocks"]:
        if "lines" in block:
            for line in block["lines"]:
                if "spans" in line:
                    current_text = ""
                    current_bbox = None
                    
                    for span in line["spans"]:
                        text = span["text"].strip()
                        if not text:
                            continue
                            
                        if current_bbox is None:
                            current_text = text
                            current_bbox = list(span["bbox"])
                        else:
                            gap = span["bbox"][0] - current_bbox[2]
                            if gap < 5:
                                current_text += " " + text
                                current_bbox[2] = span["bbox"][2]
                                current_bbox[3] = max(current_bbox[3], span["bbox"][3])
                            else:
                                if current_text:
                                    blocks.append(BoundingBox(
                                        text=current_text,
                                        bbox=current_bbox,
                                        page=page_num
                                    ))
                                current_text = text
                                current_bbox = list(span["bbox"])
                    
                    if current_text:
                        blocks.append(BoundingBox(
                            text=current_text,
                            bbox=current_bbox,
                            page=page_num
                        ))
    
    return blocks

def process_scanned_page(page, page_num) -> List[Dict]:
    """Process a scanned page using OCR with word-level bounding boxes"""
    pix = page.get_pixmap()
    img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
    
    # Get word-level data including bounding boxes
    data = pytesseract.image_to_data(img, output_type=pytesseract.Output.DICT)
    
    blocks = []
    current_text = ""
    current_bbox = None
    
    for i in range(len(data["text"])):
        text = data["text"][i].strip()
        if not text:
            if current_text:
                blocks.append({
                    "text": current_text,
                    "bbox": current_bbox,
                    "page": page_num
                })
                current_text = ""
                current_bbox = None
            continue
            
        x = float(data["left"][i])
        y = float(data["top"][i])
        w = float(data["width"][i])
        h = float(data["height"][i])
        
        if current_bbox is None:
            current_text = text
            current_bbox = [x, y, x + w, y + h]
        else:
            # Check if words are on the same line and close enough
            if (abs(y - current_bbox[1]) < h * 0.5 and 
                (x - current_bbox[2]) < w * 2):
                current_text += " " + text
                current_bbox[2] = x + w
                current_bbox[3] = max(current_bbox[3], y + h)
            else:
                blocks.append({
                    "text": current_text,
                    "bbox": current_bbox,
                    "page": page_num
                })
                current_text = text
                current_bbox = [x, y, x + w, y + h]
    
    # Add the last block
    if current_text:
        blocks.append({
            "text": current_text,
            "bbox": current_bbox,
            "page": page_num
        })
    
    return blocks

@app.get("/extract", response_model=PDFResponse)
async def extract_text(pdf_url: HttpUrl):
    try:
        # Download PDF
        pdf_content = download_pdf(str(pdf_url))
        
        # Create temporary file
        with tempfile.NamedTemporaryFile(suffix='.pdf', delete=False) as tmp_file:
            tmp_file.write(pdf_content)
            tmp_path = tmp_file.name
        
        try:
            # Open PDF
            doc = fitz.open(tmp_path)
            
            # Check page count
            if doc.page_count > 2000:
                raise HTTPException(status_code=400, detail="PDF has too many pages (max 2000)")
            
            all_blocks = []
            for page_num, page in enumerate(doc):
                text = page.get_text().strip()
                
                if not text:
                    blocks = process_scanned_page(page, page_num)
                else:
                    blocks = process_text_blocks(page, page_num)
                
                all_blocks.extend(blocks)
            
            return PDFResponse(pages=all_blocks)
            
        finally:
            # Cleanup
            if 'doc' in locals():
                doc.close()
            os.unlink(tmp_path)
            
    except requests.exceptions.RequestException as e:
        raise HTTPException(status_code=400, detail=f"Failed to download PDF: {str(e)}")
    except Exception as e:
        logger.error(f"Error processing PDF: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error processing PDF: {str(e)}")

# to run the backend
# uvicorn main:app --reload --host 0.0.0.0 --port 8000
