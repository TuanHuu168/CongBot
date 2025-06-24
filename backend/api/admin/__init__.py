from fastapi import APIRouter
from .cache_admin import router as cache_router
from .document_admin import router as document_router  
from .benchmark_admin import router as benchmark_router
from .system_admin import router as system_router

# Router chính cho admin
router = APIRouter(prefix="", tags=["admin"])

# Combine tất cả sub-routers
router.include_router(cache_router)
router.include_router(document_router)
router.include_router(benchmark_router)
router.include_router(system_router)