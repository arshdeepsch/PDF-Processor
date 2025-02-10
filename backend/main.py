from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
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
from fastapi.responses import ORJSONResponse

app = FastAPI()

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Add after CORS middleware
app.add_middleware(GZipMiddleware, minimum_size=500)

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
    """Download PDF from URL with size validation and streaming"""
    chunk_size = 8192  # 8KB chunks
    content = bytearray()
    
    try:
        with requests.get(url, stream=True) as response:
            response.raise_for_status()
            
            content_length = int(response.headers.get('content-length', 0))
            if content_length > 50 * 1024 * 1024:  # 50MB limit
                raise HTTPException(status_code=400, detail="PDF file too large (max 50MB)")
            
            for chunk in response.iter_content(chunk_size=chunk_size):
                if chunk:
                    content.extend(chunk)
                    
                    # Check size during streaming
                    if len(content) > 50 * 1024 * 1024:
                        raise HTTPException(status_code=400, detail="PDF file too large (max 50MB)")
                        
        return bytes(content)
    except requests.exceptions.RequestException as e:
        raise HTTPException(status_code=400, detail=f"Failed to download PDF: {str(e)}")

def process_text_blocks(page, page_num) -> List[Dict]:
    blocks = []
    text_page = page.get_text("dict", sort=True)
    
    for block in text_page["blocks"]:
        if "lines" not in block:
            continue
            
        current_line_text = []
        current_line_bbox = None
        first_line_in_block = True
        
        # Add block separator if not first block
        if blocks and not first_line_in_block:
            blocks.append(BoundingBox(
                text="\n\n",
                bbox=[0, len(blocks), 0, len(blocks)],
                page=page_num
            ))
        
        for line in block["lines"]:
            if "spans" not in line:
                continue
            
            # Add line break between lines in same block
            if not first_line_in_block and current_line_bbox is None:
                blocks.append(BoundingBox(
                    text="\n",
                    bbox=[0, len(blocks), 0, len(blocks)],
                    page=page_num
                ))
            
            for span in line["spans"]:
                text = span["text"].strip()
                if not text:  # Skip empty spans
                    continue
                    
                bbox = list(span["bbox"])
                
                if current_line_bbox is None:
                    current_line_text = [text]
                    current_line_bbox = bbox
                else:
                    gap = span["bbox"][0] - current_line_bbox[2]
                    if gap < 5:  # Same line
                        if text[0] not in ".,;:)?!]}'\"":  # Add space if not punctuation
                            current_line_text.append(" ")
                        current_line_text.append(text)
                        current_line_bbox[2] = span["bbox"][2]
                        current_line_bbox[3] = max(current_line_bbox[3], span["bbox"][3])
                    else:  # New line due to large gap
                        blocks.append(BoundingBox(
                            text="".join(current_line_text),
                            bbox=current_line_bbox,
                            page=page_num
                        ))
                        blocks.append(BoundingBox(
                            text=" ",
                            bbox=[current_line_bbox[2], current_line_bbox[1], 
                                 span["bbox"][0], current_line_bbox[3]],
                            page=page_num
                        ))
                        current_line_text = [text]
                        current_line_bbox = bbox
            
            if current_line_text:
                blocks.append(BoundingBox(
                    text="".join(current_line_text),
                    bbox=current_line_bbox,
                    page=page_num
                ))
                current_line_text = []
                current_line_bbox = None
                first_line_in_block = False
        
        # Add double newline after each block
        if blocks:
            blocks.append(BoundingBox(
                text="\n\n",
                bbox=[0, len(blocks), 0, len(blocks)],
                page=page_num
            ))
    
    return blocks

def process_scanned_page(page, page_num) -> List[Dict]:
    pix = page.get_pixmap()
    img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
    
    # Optimize image for OCR
    img = img.convert('L')  # Convert to grayscale
    
    # Resize large images to improve OCR speed while maintaining quality
    if img.width > 2000 or img.height > 2000:
        scale_factor = min(2000/img.width, 2000/img.height)
        new_size = (int(img.width * scale_factor), int(img.height * scale_factor))
        img = img.resize(new_size, Image.Resampling.LANCZOS)
    
    # Use better OCR config for improved speed
    config = '--oem 1 --psm 6'  # Use LSTM OCR Engine in Fast Mode
    data = pytesseract.image_to_data(img, output_type=pytesseract.Output.DICT, config=config)
    
    blocks = []
    current_text = []
    current_bbox = None
    
    for i in range(len(data["text"])):
        text = data["text"][i].strip()
        if not text:
            if current_text:
                blocks.append(BoundingBox(
                    text=" ".join(current_text),
                    bbox=current_bbox,
                    page=page_num
                ))
                current_text = []
                current_bbox = None
            continue
            
        x, y = float(data["left"][i]), float(data["top"][i])
        w, h = float(data["width"][i]), float(data["height"][i])
        
        if current_bbox is None:
            current_text = [text]
            current_bbox = [x, y, x + w, y + h]
        else:
            # Check if words are on the same line and close enough
            if (abs(y - current_bbox[1]) < h * 0.5 and 
                (x - current_bbox[2]) < w * 2):
                current_text.append(text)
                current_bbox[2] = x + w
                current_bbox[3] = max(current_bbox[3], y + h)
            else:
                blocks.append(BoundingBox(
                    text=" ".join(current_text),
                    bbox=current_bbox,
                    page=page_num
                ))
                current_text = [text]
                current_bbox = [x, y, x + w, y + h]
    
    if current_text:
        blocks.append(BoundingBox(
            text=" ".join(current_text),
            bbox=current_bbox,
            page=page_num
        ))
    
    return blocks

@app.get("/extract", response_model=PDFResponse, response_class=ORJSONResponse)
async def extract_text(pdf_url: HttpUrl):
    try:
        # Download PDF
        pdf_content = download_pdf(str(pdf_url))
        
        # Create temporary file
        with tempfile.NamedTemporaryFile(suffix='.pdf', delete=False) as tmp_file:
            tmp_file.write(pdf_content)
            tmp_path = tmp_file.name
        
        try:
            # Open PDF with memory optimization
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
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# to run the backend for local testing
# uvicorn main:app --reload --host 0.0.0.0 --port 8000
