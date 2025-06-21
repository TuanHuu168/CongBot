import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

ROOT_DIR = Path(__file__).parent.parent

DATA_DIR = os.path.join(ROOT_DIR, "data")
BENCHMARK_DIR = os.path.join(ROOT_DIR, "benchmark")
BENCHMARK_RESULTS_DIR = os.path.join(BENCHMARK_DIR, "results")

MONGODB_USERNAME = os.getenv("MONGODB_USERNAME")
MONGODB_PASSWORD = os.getenv("MONGODB_PASSWORD")
MONGODB_HOST = os.getenv("MONGODB_HOST")
MONGO_DB_NAME = os.getenv("MONGODB_DATABASE", "chatbot_db")
MONGO_URI = f"mongodb+srv://{MONGODB_USERNAME}:{MONGODB_PASSWORD}{MONGODB_HOST}/{MONGO_DB_NAME}?retryWrites=true&w=majority"

# ChromaDB Local Configuration
CHROMA_PERSIST_PATH = os.getenv("CHROMA_PERSIST_PATH", "./chroma_db")
CHROMA_COLLECTION = os.getenv("COLLECTION_NAME", "law_data")

# Tạo đường dẫn tuyệt đối cho ChromaDB
CHROMA_PERSIST_DIRECTORY = os.path.join(ROOT_DIR, CHROMA_PERSIST_PATH.lstrip('./'))

EMBEDDING_MODEL_NAME = os.getenv("EMBEDDING_MODEL")
USE_GPU = os.getenv("USE_GPU", "True").lower() == "true"

API_HOST = os.getenv("API_HOST")
API_PORT = int(os.getenv("API_PORT"))

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GEMINI_MODEL = os.getenv("GEMINI_MODEL")

TOP_K = int(os.getenv("TOP_K"))
MAX_TOKENS_PER_DOC = int(os.getenv("MAX_CONTEXT_LENGTH"))

CACHE_TTL_DAYS = int(os.getenv("CACHE_TTL_DAYS"))

MAX_CONVERSATION_TOKENS = int(os.getenv("MAX_CONVERSATION_TOKENS"))