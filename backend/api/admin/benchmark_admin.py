from fastapi import APIRouter, HTTPException, UploadFile, File
from fastapi.responses import FileResponse
from typing import Dict, Any
from pydantic import BaseModel
import os
import json
import uuid
import pandas as pd
import threading
import queue
import numpy as np

from config import BENCHMARK_DIR, BENCHMARK_RESULTS_DIR
from services.benchmark_service import benchmark_service
from services.activity_service import ActivityType
from .shared_utils import handle_admin_error, log_admin_success, now_utc

router = APIRouter()

# Global variables để track benchmark progress
benchmark_progress = {}
benchmark_results_cache = {}

class BenchmarkConfig(BaseModel):
    file_path: str = "benchmark.json"
    output_dir: str = "benchmark_results"

class BenchmarkFileInfo(BaseModel):
    filename: str
    questions_count: int
    size: int
    modified: str

class BenchmarkListResponse(BaseModel):
    files: list[BenchmarkFileInfo]

@router.post("/upload-benchmark")
async def upload_benchmark_file(file: UploadFile = File(...)):
    """Upload file benchmark mới"""
    try:
        if not file.filename.endswith('.json'):
            raise HTTPException(status_code=400, detail="Chỉ hỗ trợ file JSON")
        
        content = await file.read()
        file_content = content.decode('utf-8')
        
        try:
            json_data = json.loads(file_content)
            if "benchmark" not in json_data:
                raise HTTPException(status_code=400, detail="Format benchmark không hợp lệ. Phải chứa key 'benchmark'")
        except json.JSONDecodeError:
            raise HTTPException(status_code=400, detail="Format JSON không hợp lệ")
        
        timestamp = now_utc().strftime("%Y%m%d_%H%M%S")
        filename = f"uploaded_benchmark_{timestamp}.json"
        
        saved_filename = benchmark_service.save_uploaded_benchmark(file_content, filename)
        
        log_admin_success(
            "upload benchmark",
            f"Admin upload file benchmark {saved_filename} với {len(json_data['benchmark'])} câu hỏi",
            ActivityType.BENCHMARK_START,
            {
                "filename": saved_filename,
                "questions_count": len(json_data["benchmark"])
            }
        )
        
        return {
            "message": "Upload file benchmark thành công",
            "filename": saved_filename,
            "questions_count": len(json_data["benchmark"])
        }
        
    except HTTPException as he:
        raise he
    except Exception as e:
        handle_admin_error("upload benchmark", e, ActivityType.BENCHMARK_FAIL)

@router.post("/run-benchmark")
async def run_benchmark_all_models(config: BenchmarkConfig):
    """Chạy benchmark với 4 models"""
    try:
        benchmark_id = str(uuid.uuid4())
        
        log_admin_success(
            "khởi động benchmark",
            f"Bắt đầu chạy benchmark với file {config.file_path}",
            ActivityType.BENCHMARK_START,
            {
                "benchmark_id": benchmark_id,
                "file_path": config.file_path,
                "output_dir": config.output_dir
            }
        )
        
        progress_queue = queue.Queue()
        result_queue = queue.Queue()
        
        benchmark_progress[benchmark_id] = {
            'status': 'running',
            'progress': 0.0,
            'phase': 'starting',
            'current_step': 0,
            'total_steps': 0,
            'start_time': now_utc().isoformat()
        }
        
        def progress_callback(progress_info):
            if isinstance(progress_info, dict):
                progress_queue.put(progress_info)
            else:
                progress_queue.put({'progress': float(progress_info)})
        
        def run_benchmark_thread():
            try:
                stats = benchmark_service.run_benchmark(
                    benchmark_file=config.file_path,
                    progress_callback=progress_callback
                )
                result_queue.put(('success', stats))
            except Exception as e:
                result_queue.put(('error', str(e)))
        
        def monitor_progress():
            thread = threading.Thread(target=run_benchmark_thread)
            thread.start()
            
            while thread.is_alive():
                try:
                    progress_info = progress_queue.get(timeout=1)
                    if isinstance(progress_info, dict):
                        benchmark_progress[benchmark_id].update(progress_info)
                    else:
                        benchmark_progress[benchmark_id]['progress'] = float(progress_info)
                except queue.Empty:
                    continue
            
            try:
                status, result = result_queue.get(timeout=5)
                if status == 'success':
                    benchmark_progress[benchmark_id].update({
                        'status': 'completed',
                        'progress': 100.0,
                        'phase': 'completed',
                        'end_time': now_utc().isoformat(),
                        'stats': result
                    })
                    benchmark_results_cache[benchmark_id] = result
                    
                    log_admin_success(
                        "hoàn thành benchmark",
                        f"Hoàn thành benchmark {benchmark_id}: {result.get('total_questions', 0)} câu hỏi",
                        ActivityType.BENCHMARK_COMPLETE,
                        {
                            "benchmark_id": benchmark_id,
                            "total_questions": result.get('total_questions', 0),
                            "output_file": result.get('output_file', ''),
                            "file_path": config.file_path
                        }
                    )
                else:
                    benchmark_progress[benchmark_id].update({
                        'status': 'failed',
                        'phase': 'failed',
                        'end_time': now_utc().isoformat(),
                        'error': result
                    })
                    
                    log_admin_success(
                        "thất bại benchmark",
                        f"Thất bại khi chạy benchmark {benchmark_id}: {result}",
                        ActivityType.BENCHMARK_FAIL,
                        {
                            "benchmark_id": benchmark_id,
                            "error": result,
                            "file_path": config.file_path
                        }
                    )
            except queue.Empty:
                benchmark_progress[benchmark_id].update({
                    'status': 'failed',
                    'phase': 'timeout',
                    'end_time': now_utc().isoformat(),
                    'error': 'Benchmark timeout'
                })
                
                log_admin_success(
                    "timeout benchmark",
                    f"Benchmark {benchmark_id} timeout",
                    ActivityType.BENCHMARK_FAIL,
                    {
                        "benchmark_id": benchmark_id,
                        "error": "timeout",
                        "file_path": config.file_path
                    }
                )
        
        monitor_thread = threading.Thread(target=monitor_progress)
        monitor_thread.daemon = True
        monitor_thread.start()
        
        return {
            "message": "Benchmark đã được khởi động",
            "benchmark_id": benchmark_id,
            "status": "running"
        }
        
    except Exception as e:
        handle_admin_error("khởi động benchmark", e, ActivityType.BENCHMARK_FAIL, {"file_path": config.file_path})

@router.get("/benchmark-progress/{benchmark_id}")
async def get_benchmark_progress(benchmark_id: str):
    """Lấy tiến trình benchmark"""
    try:
        if benchmark_id not in benchmark_progress:
            raise HTTPException(status_code=404, detail="Không tìm thấy benchmark")
        
        progress_data = benchmark_progress[benchmark_id].copy()
        
        # Convert numpy types to regular Python types
        for key, value in progress_data.items():
            if isinstance(value, (np.floating, np.integer)):
                progress_data[key] = float(value)
        
        return progress_data
    except HTTPException as he:
        raise he
    except Exception as e:
        handle_admin_error("lấy tiến trình benchmark", e)
    
@router.get("/benchmark-results")
async def list_benchmark_results():
    """Liệt kê kết quả benchmark"""
    try:
        if not os.path.exists(BENCHMARK_RESULTS_DIR):
            return {"results": []}
        
        results = []
        for file in os.listdir(BENCHMARK_RESULTS_DIR):
            if file.endswith('.csv'):
                file_path = os.path.join(BENCHMARK_RESULTS_DIR, file)
                stats = {
                    "file_name": file,
                    "file_path": file_path,
                    "created_at": now_utc().strftime("%Y-%m-%d %H:%M:%S"),
                    "size_kb": round(os.path.getsize(file_path) / 1024, 2)
                }
                
                try:
                    df = pd.read_csv(file_path, encoding='utf-8-sig')
                    if not df.empty:
                        stats["questions_count"] = len(df)
                        
                        # Tính toán metrics trung bình
                        if 'STT' in df.columns:
                            summary_rows = df[df['STT'] == 'SUMMARY']
                            if not summary_rows.empty:
                                summary_row = summary_rows.iloc[0]
                                if 'current_cosine_sim' in summary_row:
                                    try:
                                        stats["avg_cosine_sim"] = float(summary_row['current_cosine_sim'])
                                    except:
                                        pass
                                if 'current_retrieval_accuracy' in summary_row:
                                    try:
                                        stats["avg_retrieval_accuracy"] = float(summary_row['current_retrieval_accuracy'])
                                    except:
                                        pass
                        else:
                            if 'current_cosine_sim' in df.columns:
                                try:
                                    numeric_values = pd.to_numeric(df['current_cosine_sim'], errors='coerce')
                                    stats["avg_cosine_sim"] = float(numeric_values.mean())
                                except:
                                    pass
                except Exception as e:
                    print(f"Lỗi khi đọc file {file}: {str(e)}")
                    stats["questions_count"] = "Unknown"
                
                results.append(stats)
        
        results.sort(key=lambda x: x["created_at"], reverse=True)
        
        return {"results": results}
    
    except Exception as e:
        handle_admin_error("liệt kê kết quả benchmark", e)

@router.get("/benchmark-results/{file_name}")
async def download_benchmark_result(file_name: str):
    """Download file kết quả benchmark"""
    file_path = os.path.join(BENCHMARK_RESULTS_DIR, file_name)
    
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail=f"Không tìm thấy file: {file_name}")
    
    return FileResponse(
        file_path, 
        media_type='text/csv;charset=utf-8',
        filename=file_name,
        headers={"Content-Disposition": f"attachment; filename={file_name}"}
    )

@router.get("/view-benchmark/{file_name}")
async def view_benchmark_content(file_name: str):
    """Xem nội dung file benchmark"""
    file_path = os.path.join(BENCHMARK_RESULTS_DIR, file_name)
    
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail=f"Không tìm thấy file: {file_name}")
    
    try:
        df = pd.read_csv(file_path, encoding='utf-8-sig')
        
        total_rows = len(df)
        columns = list(df.columns)
        
        summary_row = None
        data_rows = df
        
        if 'STT' in df.columns:
            summary_rows = df[df['STT'] == 'SUMMARY']
            if not summary_rows.empty:
                summary_row = summary_rows.iloc[0].to_dict()
                data_rows = df[df['STT'] != 'SUMMARY']
        
        model_stats = {}
        
        models = {
            'current': {
                'cosine_col': 'current_cosine_sim',
                'retrieval_col': 'current_retrieval_accuracy',
                'time_col': 'current_processing_time',
                'name': 'Current System'
            },
            'langchain': {
                'cosine_col': 'langchain_cosine_sim', 
                'retrieval_col': 'langchain_retrieval_accuracy',
                'time_col': 'langchain_processing_time',
                'name': 'LangChain'
            },
            'haystack': {
                'cosine_col': 'haystack_cosine_sim',
                'retrieval_col': 'haystack_retrieval_accuracy', 
                'time_col': 'haystack_processing_time',
                'name': 'Haystack'
            },
            'chatgpt': {
                'cosine_col': 'chatgpt_cosine_sim',
                'retrieval_col': 'chatgpt_retrieval_accuracy',
                'time_col': 'chatgpt_processing_time', 
                'name': 'ChatGPT'
            }
        }
        
        # Tính toán statistics cho từng model
        for model_key, model_info in models.items():
            stats = {
                'name': model_info['name'],
                'cosine_similarity': {'avg': 0, 'min': 0, 'max': 0, 'count': 0},
                'retrieval_accuracy': {'avg': 0, 'min': 0, 'max': 0, 'count': 0},
                'processing_time': {'avg': 0, 'min': 0, 'max': 0, 'count': 0}
            }
            
            # Cosine similarity stats
            if model_info['cosine_col'] in data_rows.columns:
                cosine_values = pd.to_numeric(data_rows[model_info['cosine_col']], errors='coerce').dropna()
                if not cosine_values.empty:
                    stats['cosine_similarity'] = {
                        'avg': float(cosine_values.mean()),
                        'min': float(cosine_values.min()),
                        'max': float(cosine_values.max()),
                        'count': int(len(cosine_values))
                    }
            
            # Retrieval accuracy stats
            if model_info['retrieval_col'] in data_rows.columns:
                retrieval_values = pd.to_numeric(data_rows[model_info['retrieval_col']], errors='coerce').dropna()
                if not retrieval_values.empty:
                    stats['retrieval_accuracy'] = {
                        'avg': float(retrieval_values.mean()),
                        'min': float(retrieval_values.min()),
                        'max': float(retrieval_values.max()),
                        'count': int(len(retrieval_values))
                    }
            
            # Processing time stats
            if model_info['time_col'] in data_rows.columns:
                time_values = pd.to_numeric(data_rows[model_info['time_col']], errors='coerce').dropna()
                if not time_values.empty:
                    stats['processing_time'] = {
                        'avg': float(time_values.mean()),
                        'min': float(time_values.min()),
                        'max': float(time_values.max()),
                        'count': int(len(time_values))
                    }
            
            model_stats[model_key] = stats
        
        # Tìm model tốt nhất cho từng metric
        best_models = {
            'cosine_similarity': max(model_stats.items(), 
                                   key=lambda x: x[1]['cosine_similarity']['avg'] if x[1]['cosine_similarity']['count'] > 0 else 0),
            'retrieval_accuracy': max(model_stats.items(), 
                                    key=lambda x: x[1]['retrieval_accuracy']['avg'] if x[1]['retrieval_accuracy']['count'] > 0 else 0),
            'processing_time': min(model_stats.items(), 
                                 key=lambda x: x[1]['processing_time']['avg'] if x[1]['processing_time']['count'] > 0 else float('inf'))
        }
        
        preview_data = data_rows.head(5).to_dict('records')
        
        return {
            "file_name": file_name,
            "total_questions": int(len(data_rows)) if 'STT' in df.columns else total_rows,
            "columns": columns,
            "model_stats": model_stats,
            "best_models": {
                'cosine_similarity': {
                    'name': best_models['cosine_similarity'][1]['name'],
                    'score': best_models['cosine_similarity'][1]['cosine_similarity']['avg']
                },
                'retrieval_accuracy': {
                    'name': best_models['retrieval_accuracy'][1]['name'], 
                    'score': best_models['retrieval_accuracy'][1]['retrieval_accuracy']['avg']
                },
                'processing_time': {
                    'name': best_models['processing_time'][1]['name'],
                    'time': best_models['processing_time'][1]['processing_time']['avg']
                }
            },
            "summary_row": summary_row,
            "preview": preview_data[:3]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Không thể đọc file: {str(e)}")

@router.get("/benchmark-files", response_model=BenchmarkListResponse)
async def list_benchmark_files():
    """Liệt kê các file benchmark có sẵn"""
    try:
        files = []
        if os.path.exists(BENCHMARK_DIR):
            for filename in os.listdir(BENCHMARK_DIR):
                if filename.endswith('.json'):
                    file_path = os.path.join(BENCHMARK_DIR, filename)
                    try:
                        with open(file_path, 'r', encoding='utf-8-sig') as f:
                            data = json.load(f)
                            questions_count = len(data.get('benchmark', []))
                        
                        file_info = BenchmarkFileInfo(
                            filename=filename,
                            questions_count=questions_count,
                            size=os.path.getsize(file_path),
                            modified=now_utc().isoformat()
                        )
                        files.append(file_info)
                    except:
                        continue
        
        return BenchmarkListResponse(files=files)
    except Exception as e:
        handle_admin_error("liệt kê file benchmark", e)