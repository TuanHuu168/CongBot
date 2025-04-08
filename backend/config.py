import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

ROOT_DIR = Path(__file__).parent.parent

DATA_DIR = os.path.join(ROOT_DIR, "data")
BENCHMARK_DIR = os.path.join(ROOT_DIR, "benchmark")
BENCHMARK_RESULTS_DIR = os.path.join(BENCHMARK_DIR, "results")

MONGODB_USERNAME = "tuan"
MONGODB_PASSWORD = "Yuechan2k3"
MONGODB_HOST = "@cluster0.txjtd7t.mongodb.net"  # Thay đổi theo host của bạn
MONGODB_DATABASE = "chatbot_db"
MONGO_URI = f"mongodb+srv://{MONGODB_USERNAME}:{MONGODB_PASSWORD}{MONGODB_HOST}/{MONGODB_DATABASE}?retryWrites=true&w=majority"

CHROMA_HOST = os.environ["CHROMA_HOST"]
CHROMA_PORT = int(os.environ["CHROMA_PORT"])
CHROMA_COLLECTION = os.environ["COLLECTION_NAME"]

EMBEDDING_MODEL_NAME = os.getenv("EMBEDDING_MODEL")
USE_GPU = os.getenv("USE_GPU", "True").lower() == "true"

API_HOST = os.getenv("API_HOST")
API_PORT = int(os.getenv("API_PORT"))

GEMINI_API_KEY = os.environ["GEMINI_API_KEY"]
GEMINI_MODEL = os.getenv("GEMINI_MODEL")

TOP_K = int(os.getenv("TOP_K"))
MAX_TOKENS_PER_DOC = int(os.getenv("MAX_CONTEXT_LENGTH"))

CACHE_TTL_DAYS = int(os.getenv("CACHE_TTL_DAYS"))

MAX_CONVERSATION_TOKENS = int(os.getenv("MAX_CONVERSATION_TOKENS"))