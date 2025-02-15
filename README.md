
## Installation & Setup

### Frontend Setup

1. Navigate to the frontend directory:
```bash
cd pdf-processor-frontend
```
2. Install dependencies:

```bash
npm install
```
3. Start the development server:
```bash
npm run dev
```
### Backend Setup

  

1. Navigate to the backend directory:
```bash
docker build -t pdf-processor-backend .
```
2. Run the Docker container:
```bash
docker run -d -p 8000:8000 pdf-processor-backend
```
## Usage
1. Open your browser and navigate to: http://localhost:3000
2. Upload a PDF file and interact with the highlights.