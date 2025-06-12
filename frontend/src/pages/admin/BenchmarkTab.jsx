import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { BarChart2, Activity, Eye, Download, Upload, Info, CheckCircle, XCircle, Clock, File, X } from 'lucide-react';
import Swal from 'sweetalert2';
import { formatDate } from '../../utils/formatUtils';
import axios from 'axios';

const API_BASE_URL = 'http://localhost:8001';

const BenchmarkTab = ({
    benchmarkResults,
    isLoading
}) => {
    const [runningBenchmark, setRunningBenchmark] = useState(false);
    const [benchmarkProgress, setBenchmarkProgress] = useState(0);
    const [currentBenchmarkId, setCurrentBenchmarkId] = useState(null);
    const [benchmarkStats, setBenchmarkStats] = useState(null);
    const [benchmarkStatus, setBenchmarkStatus] = useState('idle');
    const [benchmarkMode, setBenchmarkMode] = useState('default');
    const [selectedFile, setSelectedFile] = useState(null);
    const [uploadedFiles, setUploadedFiles] = useState([]);
    const [selectedBenchmarkFile, setSelectedBenchmarkFile] = useState('benchmark.json');

    const fadeInVariants = {
        hidden: { opacity: 0, y: 10 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.3 } }
    };

    // Load benchmark files
    useEffect(() => {
        loadBenchmarkFiles();
    }, []);

    const loadBenchmarkFiles = async () => {
        try {
            const response = await axios.get(`${API_BASE_URL}/benchmark-files`);
            setUploadedFiles(response.data.files || []);
        } catch (error) {
            console.error('Error loading benchmark files:', error);
        }
    };

    // Poll benchmark progress
    useEffect(() => {
        let interval;
        if (currentBenchmarkId && runningBenchmark) {
            interval = setInterval(async () => {
                try {
                    const response = await axios.get(`${API_BASE_URL}/benchmark-progress/${currentBenchmarkId}`);
                    const data = response.data;

                    setBenchmarkProgress(data.progress || 0);
                    setBenchmarkStatus(data.status);

                    if (data.status === 'completed') {
                        setRunningBenchmark(false);
                        setBenchmarkStats(data.stats);
                        clearInterval(interval);

                        Swal.fire({
                            icon: 'success',
                            title: 'Benchmark hoàn thành',
                            text: `Đã đánh giá ${data.stats?.total_questions || 0} câu hỏi trên 4 models`,
                            confirmButtonColor: '#10b981'
                        });
                    } else if (data.status === 'failed') {
                        setRunningBenchmark(false);
                        clearInterval(interval);

                        Swal.fire({
                            icon: 'error',
                            title: 'Benchmark thất bại',
                            text: data.error || 'Có lỗi xảy ra trong quá trình benchmark',
                            confirmButtonColor: '#10b981'
                        });
                    }
                } catch (error) {
                    console.error('Error polling benchmark progress:', error);
                }
            }, 1000);
        }

        return () => {
            if (interval) clearInterval(interval);
        };
    }, [currentBenchmarkId, runningBenchmark]);

    const handleFileUpload = async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        if (!file.name.endsWith('.json')) {
            Swal.fire({
                icon: 'error',
                title: 'File không hợp lệ',
                text: 'Chỉ hỗ trợ tải lên file JSON',
                confirmButtonColor: '#10b981'
            });
            return;
        }

        const formData = new FormData();
        formData.append('file', file);

        try {
            const response = await axios.post(`${API_BASE_URL}/upload-benchmark`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            Swal.fire({
                icon: 'success',
                title: 'Tải lên thành công',
                text: `Đã tải lên file với ${response.data.questions_count} câu hỏi`,
                confirmButtonColor: '#10b981'
            });

            setSelectedFile(null);
            setSelectedBenchmarkFile(response.data.filename);
            loadBenchmarkFiles();
            event.target.value = '';
        } catch (error) {
            console.error('Error uploading file:', error);
            Swal.fire({
                icon: 'error',
                title: 'Lỗi tải file',
                text: error.response?.data?.detail || 'Không thể tải lên file',
                confirmButtonColor: '#10b981'
            });
        }
    };

    const handleStartBenchmark = async () => {
        let fileToUse = selectedBenchmarkFile;

        if (benchmarkMode === 'upload' && !fileToUse) {
            Swal.fire({
                icon: 'warning',
                title: 'Chưa chọn file',
                text: 'Vui lòng chọn file benchmark để chạy',
                confirmButtonColor: '#10b981'
            });
            return;
        }

        Swal.fire({
            title: 'Xác nhận chạy benchmark',
            text: `Sẽ đánh giá 4 models với file ${fileToUse}. Quá trình có thể mất 10-20p. Tiếp tục?`,
            icon: 'question',
            showCancelButton: true,
            confirmButtonColor: '#10b981',
            cancelButtonColor: '#64748b',
            confirmButtonText: 'Chạy benchmark',
            cancelButtonText: 'Huỷ'
        }).then(async (result) => {
            if (result.isConfirmed) {
                try {
                    setRunningBenchmark(true);
                    setBenchmarkProgress(0);
                    setBenchmarkStats(null);
                    setBenchmarkStatus('running');

                    const response = await axios.post(`${API_BASE_URL}/run-benchmark`, {
                        file_path: fileToUse,
                        output_dir: "benchmark_results"
                    });

                    setCurrentBenchmarkId(response.data.benchmark_id);
                } catch (error) {
                    console.error('Error starting benchmark:', error);
                    setRunningBenchmark(false);

                    Swal.fire({
                        icon: 'error',
                        title: 'Lỗi khởi động benchmark',
                        text: error.response?.data?.detail || 'Không thể khởi động benchmark',
                        confirmButtonColor: '#10b981'
                    });
                }
            }
        });
    };

    const downloadBenchmarkFile = async (filename) => {
        try {
            const response = await axios.get(`${API_BASE_URL}/benchmark-results/${filename}`, {
                responseType: 'blob'
            });

            const blob = new Blob([response.data], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', filename);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Error downloading file:', error);
            Swal.fire({
                icon: 'error',
                title: 'Loi tai file',
                text: error.response?.status === 404 ? 'File không tồn tại' : 'Không thể tải xuống file',
                confirmButtonColor: '#10b981'
            });
        }
    };

    const viewBenchmarkFile = async (filename) => {
        try {
            const response = await axios.get(`${API_BASE_URL}/view-benchmark/${filename}`);
            const data = response.data;

            // Tạo HTML hiển thị chi tiết đẹp
            const modelStatsHtml = Object.entries(data.model_stats || {})
                .map(([key, stats]) => {
                    const cosineAvg = stats.cosine_similarity?.avg || 0;
                    const retrievalAvg = stats.retrieval_accuracy?.avg || 0;
                    const timeAvg = stats.processing_time?.avg || 0;
                    
                    return `
                        <div class="mb-4 p-3 border rounded bg-gray-50">
                            <h4 class="font-bold text-blue-700 mb-2">${stats.name}</h4>
                            <div class="grid grid-cols-3 gap-4 text-sm">
                                <div>
                                    <strong>Cosine Similarity:</strong><br>
                                    Avg: ${cosineAvg > 0 ? (cosineAvg * 100).toFixed(2) + '%' : 'N/A'}<br>
                                    Range: ${stats.cosine_similarity?.count > 0 ? 
                                        (stats.cosine_similarity.min * 100).toFixed(2) + '% - ' + 
                                        (stats.cosine_similarity.max * 100).toFixed(2) + '%' : 'N/A'}
                                </div>
                                <div>
                                    <strong>Retrieval Accuracy:</strong><br>
                                    Avg: ${retrievalAvg > 0 ? (retrievalAvg * 100).toFixed(2) + '%' : 'N/A'}<br>
                                    Range: ${stats.retrieval_accuracy?.count > 0 ? 
                                        (stats.retrieval_accuracy.min * 100).toFixed(2) + '% - ' + 
                                        (stats.retrieval_accuracy.max * 100).toFixed(2) + '%' : 'N/A'}
                                </div>
                                <div>
                                    <strong>Processing Time:</strong><br>
                                    Avg: ${timeAvg > 0 ? timeAvg.toFixed(3) + 's' : 'N/A'}<br>
                                    Range: ${stats.processing_time?.count > 0 ? 
                                        stats.processing_time.min.toFixed(3) + 's - ' + 
                                        stats.processing_time.max.toFixed(3) + 's' : 'N/A'}
                                </div>
                            </div>
                            <div class="mt-2 text-xs text-gray-600">
                                Samples: ${Math.max(
                                    stats.cosine_similarity?.count || 0, 
                                    stats.retrieval_accuracy?.count || 0, 
                                    stats.processing_time?.count || 0
                                )}
                            </div>
                        </div>
                    `;
                })
                .join('');

            const bestModelsHtml = data.best_models ? `
                <div class="mt-4 p-3 bg-green-50 rounded border">
                    <h4 class="font-bold text-green-700 mb-2">Models tốt nhất</h4>
                    <div class="grid grid-cols-3 gap-4 text-sm">
                        <div>
                            <strong>Cosine Similarity:</strong><br>
                            ${data.best_models.cosine_similarity?.name || 'N/A'}<br>
                            (${data.best_models.cosine_similarity?.score ? 
                                (data.best_models.cosine_similarity.score * 100).toFixed(2) + '%' : 'N/A'})
                        </div>
                        <div>
                            <strong>Retrieval Accuracy:</strong><br>
                            ${data.best_models.retrieval_accuracy?.name || 'N/A'}<br>
                            (${data.best_models.retrieval_accuracy?.score ? 
                                (data.best_models.retrieval_accuracy.score * 100).toFixed(2) + '%' : 'N/A'})
                        </div>
                        <div>
                            <strong>Processing Speed:</strong><br>
                            ${data.best_models.processing_time?.name || 'N/A'}<br>
                            (${data.best_models.processing_time?.time ? 
                                data.best_models.processing_time.time.toFixed(3) + 's' : 'N/A'})
                        </div>
                    </div>
                </div>
            ` : '';

            // Hiển thị modal với thông tin chi tiết
            Swal.fire({
                title: `Chi tiet Benchmark: ${filename}`,
                html: `
                    <div class="text-left max-h-96 overflow-y-auto">
                        <div class="mb-4 p-3 bg-blue-50 rounded">
                            <h4 class="font-bold text-blue-700 mb-2">Thông tin tổng quan</h4>
                            <div class="text-sm">
                                <p><strong>Tổng số câu hỏi:</strong> ${data.total_questions || data.total_rows}</p>
                                <p><strong>Số cột dữ liệu:</strong> ${data.columns?.length || 0}</p>
                                <p><strong>File:</strong> ${filename}</p>
                            </div>
                        </div>
                        
                        <h4 class="font-bold text-gray-700 mb-3">Chi tiết theo từng model</h4>
                        ${modelStatsHtml || '<p class="text-gray-500">Không có thông tin chi tiết</p>'}
                        
                        ${bestModelsHtml}
                    </div>
                `,
                width: 800,
                confirmButtonText: 'Đóng',
                confirmButtonColor: '#10b981',
                showCancelButton: true,
                cancelButtonText: 'Tải CSV',
                cancelButtonColor: '#3b82f6'
            }).then((result) => {
                if (result.dismiss === Swal.DismissReason.cancel) {
                    downloadBenchmarkFile(filename);
                }
            });
        } catch (error) {
            console.error('Error viewing file:', error);
            Swal.fire({
                icon: 'error',
                title: 'Lỗi xem file',
                text: 'Không thể xem nội dung file',
                confirmButtonColor: '#10b981'
            });
        }
    };

    // Helper functions for getting best models
    const getBestModel = (stats) => {
        if (!stats) return null;
        const scores = {
            'Current System': stats.current_avg_cosine || 0,
            'LangChain': stats.langchain_avg_cosine || 0,
            'Haystack': stats.haystack_avg_cosine || 0,
            'ChatGPT': stats.chatgpt_avg_cosine || 0
        };
        const best = Object.keys(scores).reduce((a, b) => scores[a] > scores[b] ? a : b);
        return { name: best, score: scores[best] };
    };

    const getFastestModel = (stats) => {
        if (!stats) return null;
        const times = {
            'Current System': stats.current_avg_time || Infinity,
            'LangChain': stats.langchain_avg_time || Infinity,
            'Haystack': stats.haystack_avg_time || Infinity,
            'ChatGPT': stats.chatgpt_avg_time || Infinity
        };
        const fastest = Object.keys(times).reduce((a, b) => times[a] < times[b] ? a : b);
        return { name: fastest, time: times[fastest] };
    };

    const getOverallBest = (stats) => {
        // Weighted score: 60% accuracy + 40% speed (inverse)
        if (!stats) return null;
        const models = ['current', 'langchain', 'haystack', 'chatgpt'];
        const names = ['Current System', 'LangChain', 'Haystack', 'ChatGPT'];
        
        let bestScore = -1;
        let bestModel = null;
        
        models.forEach((model, idx) => {
            const accuracy = stats[`${model}_avg_cosine`] || 0;
            const time = stats[`${model}_avg_time`] || Infinity;
            const speedScore = time === Infinity ? 0 : 1 / time;
            const overallScore = accuracy * 0.6 + (speedScore / 10) * 0.4; // Normalize speed
            
            if (overallScore > bestScore) {
                bestScore = overallScore;
                bestModel = names[idx];
            }
        });
        
        return { name: bestModel, score: bestScore };
    };

    return (
        <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Benchmark Results */}
                <motion.div
                    className="md:col-span-2 bg-white rounded-xl shadow-sm mb-6 border border-gray-100"
                    variants={fadeInVariants}
                    initial="hidden"
                    animate="visible"
                >
                    <div className="p-5 border-b border-gray-100">
                        <h2 className="text-lg font-semibold flex items-center">
                            <BarChart2 size={18} className="text-green-600 mr-2" />
                            Kết quả Benchmark 4 Models
                        </h2>
                    </div>

                    <div className="p-5">
                        {/* Current benchmark status */}
                        {runningBenchmark && (
                            <div className="mb-6 p-4 bg-blue-50 rounded-lg">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-blue-700 font-medium">Đang chạy benchmark 4 models...</span>
                                    <span className="text-blue-600 text-sm">{Math.round(benchmarkProgress)}%</span>
                                </div>
                                <div className="w-full bg-blue-200 rounded-full h-2">
                                    <div
                                        className="bg-blue-600 h-2 rounded-full transition-all duration-500"
                                        style={{ width: `${benchmarkProgress}%` }}
                                    ></div>
                                </div>
                                <div className="mt-2 text-xs text-blue-600">
                                    File: {selectedBenchmarkFile} | Models: Current System, LangChain, Haystack, ChatGPT
                                </div>
                            </div>
                        )}

                        {/* Benchmark stats - Enhanced display */}
                        {benchmarkStats && (
                            <div className="mb-6 p-4 bg-green-50 rounded-lg">
                                <h3 className="text-green-700 font-medium mb-3">Kết quả benchmark mới nhất</h3>
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
                                    {/* Cosine Similarity */}
                                    <div>
                                        <div className="font-medium text-gray-700 mb-2">Cosine Similarity (Avg)</div>
                                        <div className="space-y-1">
                                            <div className="flex justify-between items-center">
                                                <span>Current System:</span>
                                                <div className="text-right">
                                                    <span className="font-medium">{((benchmarkStats.current_avg_cosine || 0) * 100).toFixed(2)}%</span>
                                                    <span className="text-xs text-gray-500 ml-2">({(benchmarkStats.current_avg_time || 0).toFixed(3)}s)</span>
                                                </div>
                                            </div>
                                            <div className="flex justify-between items-center">
                                                <span>LangChain:</span>
                                                <div className="text-right">
                                                    <span className="font-medium">{((benchmarkStats.langchain_avg_cosine || 0) * 100).toFixed(2)}%</span>
                                                    <span className="text-xs text-gray-500 ml-2">({(benchmarkStats.langchain_avg_time || 0).toFixed(3)}s)</span>
                                                </div>
                                            </div>
                                            <div className="flex justify-between items-center">
                                                <span>Haystack:</span>
                                                <div className="text-right">
                                                    <span className="font-medium">{((benchmarkStats.haystack_avg_cosine || 0) * 100).toFixed(2)}%</span>
                                                    <span className="text-xs text-gray-500 ml-2">({(benchmarkStats.haystack_avg_time || 0).toFixed(3)}s)</span>
                                                </div>
                                            </div>
                                            <div className="flex justify-between items-center">
                                                <span>ChatGPT:</span>
                                                <div className="text-right">
                                                    <span className="font-medium">{((benchmarkStats.chatgpt_avg_cosine || 0) * 100).toFixed(2)}%</span>
                                                    <span className="text-xs text-gray-500 ml-2">({(benchmarkStats.chatgpt_avg_time || 0).toFixed(3)}s)</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Retrieval Accuracy */}
                                    <div>
                                        <div className="font-medium text-gray-700 mb-2">Retrieval Accuracy (Avg)</div>
                                        <div className="space-y-1">
                                            <div className="flex justify-between">
                                                <span>Current System:</span>
                                                <span className="font-medium">{((benchmarkStats.current_avg_retrieval || 0) * 100).toFixed(2)}%</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span>LangChain:</span>
                                                <span className="font-medium">{((benchmarkStats.langchain_avg_retrieval || 0) * 100).toFixed(2)}%</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span>Haystack:</span>
                                                <span className="font-medium">{((benchmarkStats.haystack_avg_retrieval || 0) * 100).toFixed(2)}%</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span>ChatGPT:</span>
                                                <span className="text-gray-500">N/A (No retrieval)</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Hiển thị model tốt nhất */}
                                <div className="mt-4 p-3 bg-white rounded border">
                                    <div className="text-xs text-gray-600 mb-2">Models tốt nhất:</div>
                                    <div className="grid grid-cols-3 gap-4 text-xs">
                                        <div>
                                            <span className="font-medium">Chính xác:</span> {getBestModel(benchmarkStats)?.name || 'N/A'}
                                        </div>
                                        <div>
                                            <span className="font-medium">Tốc độ:</span> {getFastestModel(benchmarkStats)?.name || 'N/A'}
                                        </div>
                                        <div>
                                            <span className="font-medium">Overall:</span> {getOverallBest(benchmarkStats)?.name || 'N/A'}
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-3 flex justify-between items-center">
                                    <span className="text-xs text-gray-500">
                                        Tổng số câu hỏi: {benchmarkStats.total_questions || 0} | 
                                        Model nhanh nhất: {getFastestModel(benchmarkStats)?.name || 'N/A'} | 
                                        Model chính xác nhất: {getBestModel(benchmarkStats)?.name || 'N/A'}
                                    </span>
                                    <button
                                        onClick={() => downloadBenchmarkFile(benchmarkStats.output_file)}
                                        className="text-xs bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700 transition-colors"
                                    >
                                        Tải CSV chi tiết
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Historical results */}
                        {isLoading ? (
                            <div className="py-4 flex justify-center">
                                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-green-500"></div>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {benchmarkResults && benchmarkResults.length > 0 ? (
                                    benchmarkResults.map((result, index) => (
                                        <div key={index} className="border border-gray-200 rounded-lg hover:shadow-sm transition-shadow">
                                            <div className="p-4">
                                                <div className="flex justify-between items-start">
                                                    <div>
                                                        <h3 className="text-sm font-medium text-gray-900">{result.file_name}</h3>
                                                        <p className="mt-1 text-xs text-gray-500">Thời gian chạy: {formatDate(result.created_at)}</p>
                                                    </div>
                                                    <div className="flex space-x-1">
                                                        <button
                                                            className="p-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
                                                            onClick={() => viewBenchmarkFile(result.file_name)}
                                                            title="Xem chi tiet"
                                                        >
                                                            <Eye size={14} />
                                                        </button>
                                                        <button
                                                            className="p-1.5 rounded-lg bg-green-50 text-green-600 hover:bg-green-100 transition-colors"
                                                            onClick={() => downloadBenchmarkFile(result.file_name)}
                                                            title="Tai xuong"
                                                        >
                                                            <Download size={14} />
                                                        </button>
                                                    </div>
                                                </div>

                                                <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
                                                    <div className="flex items-center">
                                                        <Activity size={12} className="mr-1" />
                                                        <span>Kích thước: {result.size_kb} KB</span>
                                                    </div>
                                                    {result.questions_count !== undefined && (
                                                        <div className="flex items-center">
                                                            <Info size={12} className="mr-1" />
                                                            <span>{result.questions_count} Câu hỏi</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="py-10 text-center">
                                        <div className="inline-flex items-center justify-center h-12 w-12 rounded-full bg-gray-100 mb-3">
                                            <BarChart2 size={24} className="text-gray-400" />
                                        </div>
                                        <p className="text-gray-500 text-sm">Chưa có kết quả benchmark nào</p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </motion.div>

                {/* Run Benchmark Control Panel */}
                <motion.div
                    className="bg-white rounded-xl shadow-sm mb-6 border border-gray-100"
                    variants={fadeInVariants}
                    initial="hidden"
                    animate="visible"
                >
                    <div className="p-5 border-b border-gray-100">
                        <h2 className="text-lg font-semibold flex items-center">
                            <Activity size={18} className="text-green-600 mr-2" />
                            Chạy Benchmark
                        </h2>
                    </div>

                    <div className="p-5">
                        <div className="space-y-4">
                            {/* Mode selection */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Chọn file benchmark</label>
                                <div className="space-y-2">
                                    <label className="flex items-center">
                                        <input
                                            type="radio"
                                            name="benchmarkMode"
                                            value="default"
                                            checked={benchmarkMode === 'default'}
                                            onChange={(e) => {
                                                setBenchmarkMode(e.target.value);
                                                setSelectedBenchmarkFile('benchmark.json');
                                            }}
                                            className="mr-2"
                                        />
                                        <span className="text-sm">File mặc định (benchmark.json)</span>
                                    </label>
                                    <label className="flex items-center">
                                        <input
                                            type="radio"
                                            name="benchmarkMode"
                                            value="upload"
                                            checked={benchmarkMode === 'upload'}
                                            onChange={(e) => setBenchmarkMode(e.target.value)}
                                            className="mr-2"
                                        />
                                        <span className="text-sm">Chọn file khác</span>
                                    </label>
                                </div>
                            </div>

                            {/* File selection for upload mode */}
                            {benchmarkMode === 'upload' && (
                                <div className="space-y-3">
                                    {/* File upload */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Tải file mới
                                        </label>
                                        <div className="flex items-center space-x-2">
                                            <input
                                                type="file"
                                                accept=".json"
                                                onChange={handleFileUpload}
                                                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-green-50 file:text-green-700 hover:file:bg-green-100"
                                            />
                                        </div>
                                    </div>

                                    {/* Available files */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Hoặc chọn file đã tải lên
                                        </label>
                                        <select
                                            value={selectedBenchmarkFile}
                                            onChange={(e) => setSelectedBenchmarkFile(e.target.value)}
                                            className="block w-full py-2 px-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm bg-white"
                                        >
                                            <option value="">-- Chọn file --</option>
                                            {uploadedFiles.map((file) => (
                                                <option key={file.filename} value={file.filename}>
                                                    {file.filename} ({file.questions_count} câu hỏi)
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            )}

                            {/* Benchmark description */}
                            <div className="p-4 bg-amber-50 rounded-lg">
                                <h3 className="text-amber-700 text-base font-medium mb-2">Benchmark 4 Models</h3>
                                <p className="text-sm text-gray-600 mb-3">
                                    Đánh giá hiệu suất của 4 phuong pháp khác nhau trong việc trả lời câu hỏi từ dữ liệu benchmark.
                                </p>

                                <div className="mb-3 text-xs text-gray-600">
                                    <div>• Current System: RAG với ChromaDB + Gemini</div>
                                    <div>• LangChain: Similarity search + Gemini</div>
                                    <div>• Haystack: BM25 retrieval + Gemini</div>
                                    <div>• ChatGPT: GPT-4o với cùng context</div>
                                </div>

                                <div className="mb-3 text-xs text-gray-600">
                                    <div><strong>Metrics:</strong> Cosine Similarity + Retrieval Accuracy + Processing Time</div>
                                    <div><strong>Embedding:</strong> multilingual-e5-base (cong bang cho tat ca)</div>
                                </div>

                                <button
                                    onClick={handleStartBenchmark}
                                    disabled={runningBenchmark || isLoading}
                                    className="flex items-center justify-center w-full py-2 px-4 bg-gradient-to-r from-amber-500 to-orange-600 text-white hover:opacity-90 transition-opacity rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {runningBenchmark ? (
                                        <>
                                            <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-white mr-2"></div>
                                            <span>Đang chạy...</span>
                                        </>
                                    ) : (
                                        <>
                                            <BarChart2 size={16} className="mr-2" />
                                            <span>Chạy benchmark 4 models</span>
                                        </>
                                    )}
                                </button>
                            </div>

                            {/* Stats */}
                            <div className="mt-4">
                                <h3 className="text-sm font-medium text-gray-700 mb-2">Thống kê</h3>
                                <div className="space-y-2">
                                    <div className="flex justify-between">
                                        <span className="text-sm text-gray-600">Files benchmark:</span>
                                        <span className="text-sm font-medium text-gray-900">{uploadedFiles.length + 1}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-sm text-gray-600">Kết quả đã lưu:</span>
                                        <span className="text-sm font-medium text-gray-900">{benchmarkResults?.length || 0}</span>
                                    </div>
                                    {benchmarkStats && (
                                        <div className="flex justify-between">
                                            <span className="text-sm text-gray-600">Lần chạy gần nhất:</span>
                                            <span className="text-sm font-medium text-gray-900">
                                                {benchmarkStats.total_questions} câu hỏi
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </motion.div>
            </div>
        </div>
    );
};

export default BenchmarkTab;