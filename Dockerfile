# FINAL Dockerfile - Dứt điểm cho Railway deployment
FROM python:3.10.16-slim-bookworm

# System dependencies
RUN apt-get update && apt-get install -y \
    build-essential curl git gcc g++ cmake pkg-config libhdf5-dev libpq-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Upgrade pip và disable dependency resolver để force install
RUN pip install --upgrade pip wheel setuptools
RUN pip config set global.disable-pip-version-check true

# PHASE 1: Install core packages WITHOUT conflicts
RUN pip install --no-cache-dir \
    numpy==2.2.5 \
    scipy==1.15.2 \
    typing_extensions \
    typing-inspect \
    typing-inspection \
    annotated-types \
    pydantic_core==2.33.1 \
    packaging \
    certifi \
    charset-normalizer \
    idna \
    urllib3==2.4.0 \
    requests==2.32.3 \
    six \
    python-dateutil \
    pytz \
    regex \
    joblib \
    h11 \
    anyio \
    sniffio

# PHASE 2: Install Pydantic and FastAPI stack
RUN pip install --no-cache-dir \
    pydantic==2.11.3 \
    fastapi==0.115.9 \
    uvicorn==0.34.3 \
    starlette==0.45.3 \
    python-multipart==0.0.20 \
    python-dotenv==1.1.0

# PHASE 3: PyTorch CPU
RUN pip install --no-cache-dir \
    torch==2.5.1+cpu torchvision==0.20.1+cpu torchaudio==2.5.1+cpu \
    --index-url https://download.pytorch.org/whl/cpu

# PHASE 4: Database
RUN pip install --no-cache-dir \
    pymongo==4.13.0

# PHASE 5: Google AI packages - FORCE INSTALL strategy
RUN pip install --no-cache-dir google-generativeai==0.8.5
RUN pip install --force-reinstall --no-deps \
    google-ai-generativelanguage==0.6.17
RUN pip install --force-reinstall --no-deps \
    google-genai==1.11.0
RUN pip install --no-cache-dir \
    grpcio==1.71.0 \
    grpcio-status==1.71.0 \
    google-auth==2.39.0 \
    google-api-core==2.24.2 \
    protobuf==5.29.4

# PHASE 6: AI/ML packages
RUN pip install --no-cache-dir \
    transformers==4.51.3 \
    tokenizers==0.21.1 \
    huggingface-hub==0.30.2 \
    safetensors==0.5.3

RUN pip install --no-cache-dir \
    sentence-transformers==4.1.0 || pip install --no-deps sentence-transformers==4.1.0

# PHASE 7: ChromaDB
RUN pip install --no-cache-dir chromadb==0.6.3 || \
    pip install --no-deps chromadb==0.6.3
RUN pip install --no-deps chroma-hnswlib==0.7.6

# PHASE 8: Scikit-learn
RUN pip install --no-cache-dir scikit-learn==1.6.1

# PHASE 9: Pandas
RUN pip install --no-cache-dir pandas==2.3.0

# PHASE 10: Web utilities
RUN pip install --no-cache-dir \
    httpx==0.28.1 \
    httpcore==1.0.8 \
    aiohttp==3.11.18

# PHASE 10.5: Add Elasticsearch for cloud usage
RUN pip install --no-cache-dir \
    elasticsearch==8.16.0

# PHASE 10.6: Add document processing libraries
RUN pip install --no-cache-dir \
    PyMuPDF==1.25.2 \
    python-docx==1.1.2 \
    olefile==0.47

# PHASE 11: Security and utilities
RUN pip install --no-cache-dir \
    bcrypt==4.3.0 \
    cryptography==44.0.2 \
    email_validator==2.2.0 \
    click==8.1.8 \
    tqdm==4.67.1 \
    tenacity==9.1.2 \
    backoff==2.2.1 \
    rich==14.0.0

# PHASE 12: LangChain (optional)
RUN pip install --no-cache-dir \
    langsmith==0.3.33 \
    langchain-core==0.3.55 || echo "LangChain core failed"
RUN pip install --no-deps \
    langchain==0.3.24 \
    langchain-chroma==0.2.3 \
    langchain-community==0.3.22 \
    langchain-google-genai==2.1.3 \
    langchain-huggingface==0.1.2 \
    langchain-text-splitters==0.3.8 || echo "LangChain modules failed"

# PHASE 13: Optional packages
RUN pip install --no-deps \
    openai==1.82.0 \
    haystack-ai==2.14.0 || echo "Optional packages failed"

# Create user for Hugging Face
RUN useradd --create-home --shell /bin/bash user
USER user
WORKDIR /home/user/app

# Environment variables for Hugging Face
ENV PATH="/home/user/.local/bin:/usr/local/bin:$PATH"
ENV PYTHONPATH="/home/user/app:/home/user/app/backend:$PYTHONPATH"
ENV PYTHONUNBUFFERED=1
ENV CUDA_VISIBLE_DEVICES=""
ENV USE_GPU=False
ENV HF_SPACE=True

# Copy application code and data
COPY --chown=user:user backend/ ./backend/
COPY --chown=user:user chroma_db/ ./chroma_db/
COPY --chown=user:user data/ ./data/

# Create necessary directories
RUN mkdir -p logs tmp benchmark/results

# Create .env file with default values for Hugging Face
RUN echo "GEMINI_API_KEY=your_gemini_api_key_here" > .env && \
    echo "MONGO_URI=mongodb://localhost:27017" >> .env && \
    echo "CHROMA_PERSIST_DIRECTORY=./chroma_db" >> .env && \
    echo "DATA_DIR=./data" >> .env && \
    echo "USE_GPU=False" >> .env && \
    echo "HF_SPACE=True" >> .env

# Change working directory to backend
WORKDIR /home/user/app/backend

# Expose Hugging Face Spaces port
EXPOSE 7860

# Start command for Hugging Face Spaces
CMD ["python", "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "7860", "--access-log"]