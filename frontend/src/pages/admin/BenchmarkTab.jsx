import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Activity, Eye, Download, Upload, Info, CheckCircle, XCircle, Clock, File, X } from 'lucide-react';
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
    const [benchmarkPhase, setBenchmarkPhase] = useState('');
    const [currentStep, setCurrentStep] = useState(0);
    const [totalSteps, setTotalSteps] = useState(0);
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

    // Poll benchmark progress with enhanced tracking
    useEffect(() => {
        let interval;
        if (currentBenchmarkId && runningBenchmark) {
            interval = setInterval(async () => {
                try {
                    const response = await axios.get(`${API_BASE_URL}/benchmark-progress/${currentBenchmarkId}`);
                    const data = response.data;

                    setBenchmarkProgress(data.progress || 0);
                    setBenchmarkStatus(data.status);
                    setBenchmarkPhase(data.phase || '');
                    setCurrentStep(data.current_step || 0);
                    setTotalSteps(data.total_steps || 0);

                    if (data.status === 'completed') {
                        setRunningBenchmark(false);
                        setBenchmarkStats(data.stats);
                        clearInterval(interval);

                        Swal.fire({
                            title: 'Benchmark hoàn thành',
                            text: `Đã đánh giá ${data.stats?.total_questions || 0} câu hỏi trên 4 models với entity extraction`,
                            confirmButtonColor: '#10b981'
                        });
                    } else if (data.status === 'failed') {
                        setRunningBenchmark(false);
                        clearInterval(interval);

                        Swal.fire({
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

    const getPhaseDisplay = (phase) => {
        const phaseMap = {
            'starting': 'Đang khởi động...',
            'extracting_benchmark_entities': 'Trích xuất entities từ benchmark',
            'processing_models': 'Xử lý với 4 models',
            'current_system': 'Hệ thống hiện tại',
            'langchain': 'LangChain', 
            'haystack': 'Haystack',
            'chatgpt': 'ChatGPT',
            'finalizing': 'Hoàn thiện kết quả',
            'completed': 'Hoàn thành',
            'failed': 'Thất bại'
        };
        return phaseMap[phase] || phase;
    };

    const getPhaseColor = (phase) => {
        const colorMap = {
            'starting': 'text-blue-600',
            'extracting_benchmark_entities': 'text-purple-600',
            'processing_models': 'text-green-600',
            'current_system': 'text-emerald-600',
            'langchain': 'text-blue-600',
            'haystack': 'text-orange-600', 
            'chatgpt': 'text-pink-600',
            'finalizing': 'text-indigo-600',
            'completed': 'text-green-600',
            'failed': 'text-red-600'
        };
        return colorMap[phase] || 'text-gray-600';
    };

    const handleFileUpload = async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        if (!file.name.endsWith('.json')) {
            Swal.fire({
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
                title: 'Chưa chọn file',
                text: 'Vui lòng chọn file benchmark để chạy',
                confirmButtonColor: '#10b981'
            });
            return;
        }

        Swal.fire({
            title: 'Xác nhận chạy benchmark',
            html: `
                <div class="text-left">
                    <p><strong>File:</strong> ${fileToUse}</p>
                    <p><strong>Models:</strong> Current System, LangChain, Haystack, ChatGPT</p>
                    <p><strong>Metrics:</strong> Cosine Similarity + Entity Similarity + Retrieval Accuracy</p>
                    <p><strong>Thời gian dự kiến:</strong> 15-30 phút</p>
                    <p class="text-sm text-gray-600 mt-2">Sẽ có delay giữa các API call để tránh quá tải</p>
                </div>
            `,
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
                    setCurrentStep(0);
                    setTotalSteps(0);
                    setBenchmarkStats(null);
                    setBenchmarkStatus('running');
                    setBenchmarkPhase('starting');

                    const response = await axios.post(`${API_BASE_URL}/run-benchmark`, {
                        file_path: fileToUse,
                        output_dir: "benchmark_results"
                    });

                    setCurrentBenchmarkId(response.data.benchmark_id);
                } catch (error) {
                    console.error('Error starting benchmark:', error);
                    setRunningBenchmark(false);

                    Swal.fire({
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
                title: 'Lỗi tải file',
                text: error.response?.status === 404 ? 'File không tồn tại' : 'Không thể tải xuống file',
                confirmButtonColor: '#10b981'
            });
        }
    };

    const viewBenchmarkFile = async (filename) => {
        try {
            const response = await axios.get(`${API_BASE_URL}/view-benchmark/${filename}`);
            const data = response.data;

            // Enhanced display with entity similarity
            const modelStatsHtml = Object.entries(data.model_stats || {})
                .map(([key, stats]) => {
                    const cosineAvg = stats.cosine_similarity?.avg || 0;
                    const entityAvg = stats.entity_similarity?.avg || 0;
                    const retrievalAvg = stats.retrieval_accuracy?.avg || 0;
                    const timeAvg = stats.processing_time?.avg || 0;
                    
                    return `
                        <div class="mb-4 p-3 border rounded bg-gray-50">
                            <h4 class="font-bold text-blue-700 mb-2">${stats.name}</h4>
                            <div class="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                    <strong>Cosine Similarity:</strong><br>
                                    Avg: ${cosineAvg > 0 ? (cosineAvg * 100).toFixed(2) + '%' : 'N/A'}
                                </div>
                                <div>
                                    <strong>Entity Similarity:</strong><br>
                                    Avg: ${entityAvg > 0 ? (entityAvg * 100).toFixed(2) + '%' : 'N/A'}
                                </div>
                                <div>
                                    <strong>Retrieval Accuracy:</strong><br>
                                    Avg: ${retrievalAvg > 0 ? (retrievalAvg * 100).toFixed(2) + '%' : 'N/A'}
                                </div>
                                <div>
                                    <strong>Processing Time:</strong><br>
                                    Avg: ${timeAvg > 0 ? timeAvg.toFixed(3) + 's' : 'N/A'}
                                </div>
                            </div>
                        </div>
                    `;
                })
                .join('');

            Swal.fire({
                title: `Chi tiết Benchmark: ${filename}`,
                html: `
                    <div class="text-left max-h-96 overflow-y-auto">
                        <div class="mb-4 p-3 bg-blue-50 rounded">
                            <h4 class="font-bold text-blue-700 mb-2">Thông tin tổng quan</h4>
                            <div class="text-sm">
                                <p><strong>Tổng số câu hỏi:</strong> ${data.total_questions || data.total_rows}</p>
                                <p><strong>Metrics:</strong> Cosine + Entity + Retrieval + Time</p>
                                <p><strong>File:</strong> ${filename}</p>
                            </div>
                        </div>
                        
                        <h4 class="font-bold text-gray-700 mb-3">Chi tiết theo từng model</h4>
                        ${modelStatsHtml || '<p class="text-gray-500">Không có thông tin chi tiết</p>'}
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
                title: 'Lỗi xem file',
                text: 'Không thể xem nội dung file',
                confirmButtonColor: '#10b981'
            });
        }
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
                            <Activity size={18} className="text-green-600 mr-2" />
                            Kết quả Benchmark với Entity Extraction
                        </h2>
                    </div>

                    <div className="p-5">
                        {/* Enhanced benchmark status display */}
                        {runningBenchmark && (
                            <div className="mb-6 p-4 bg-blue-50 rounded-lg">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-blue-700 font-medium">Đang chạy benchmark 4 models...</span>
                                    <span className="text-blue-600 text-sm">{Math.round(benchmarkProgress)}%</span>
                                </div>
                                
                                <div className="w-full bg-blue-200 rounded-full h-3 mb-2">
                                    <div
                                        className="bg-blue-600 h-3 rounded-full transition-all duration-500"
                                        style={{ width: `${benchmarkProgress}%` }}
                                    ></div>
                                </div>
                                
                                <div className="flex justify-between items-center text-sm">
                                    <span className={`font-medium ${getPhaseColor(benchmarkPhase)}`}>
                                        {getPhaseDisplay(benchmarkPhase)}
                                    </span>
                                    {totalSteps > 0 && (
                                        <span className="text-gray-600">
                                            {currentStep}/{totalSteps}
                                        </span>
                                    )}
                                </div>
                                
                                <div className="mt-2 text-xs text-blue-600">
                                    File: {selectedBenchmarkFile} | Models: Current + LangChain + Haystack + ChatGPT | Metrics: Cosine + Entity + Retrieval
                                </div>
                            </div>
                        )}

                        {/* Enhanced benchmark stats with entity similarity */}
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
                                                <span className="font-medium">{((benchmarkStats.current_avg_cosine || 0) * 100).toFixed(2)}%</span>
                                            </div>
                                            <div className="flex justify-between items-center">
                                                <span>LangChain:</span>
                                                <span className="font-medium">{((benchmarkStats.langchain_avg_cosine || 0) * 100).toFixed(2)}%</span>
                                            </div>
                                            <div className="flex justify-between items-center">
                                                <span>Haystack:</span>
                                                <span className="font-medium">{((benchmarkStats.haystack_avg_cosine || 0) * 100).toFixed(2)}%</span>
                                            </div>
                                            <div className="flex justify-between items-center">
                                                <span>ChatGPT:</span>
                                                <span className="font-medium">{((benchmarkStats.chatgpt_avg_cosine || 0) * 100).toFixed(2)}%</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Entity Similarity */}
                                    <div>
                                        <div className="font-medium text-gray-700 mb-2">Entity Similarity (Avg)</div>
                                        <div className="space-y-1">
                                            <div className="flex justify-between items-center">
                                                <span>Current System:</span>
                                                <span className="font-medium">{((benchmarkStats.current_avg_entity || 0) * 100).toFixed(2)}%</span>
                                            </div>
                                            <div className="flex justify-between items-center">
                                                <span>LangChain:</span>
                                                <span className="font-medium">{((benchmarkStats.langchain_avg_entity || 0) * 100).toFixed(2)}%</span>
                                            </div>
                                            <div className="flex justify-between items-center">
                                                <span>Haystack:</span>
                                                <span className="font-medium">{((benchmarkStats.haystack_avg_entity || 0) * 100).toFixed(2)}%</span>
                                            </div>
                                            <div className="flex justify-between items-center">
                                                <span>ChatGPT:</span>
                                                <span className="font-medium">{((benchmarkStats.chatgpt_avg_entity || 0) * 100).toFixed(2)}%</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-4 flex justify-between items-center">
                                    <span className="text-xs text-gray-500">
                                        Tổng số câu hỏi: {benchmarkStats.total_questions || 0} | 
                                        Entity extraction được thực hiện cho tất cả models
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

                        {/* Historical results remain the same */}
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
                                                            title="Xem chi tiết"
                                                        >
                                                            <Eye size={14} />
                                                        </button>
                                                        <button
                                                            className="p-1.5 rounded-lg bg-green-50 text-green-600 hover:bg-green-100 transition-colors"
                                                            onClick={() => downloadBenchmarkFile(result.file_name)}
                                                            title="Tải xuống"
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
                                            <Activity size={24} className="text-gray-400" />
                                        </div>
                                        <p className="text-gray-500 text-sm">Chưa có kết quả benchmark nào</p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </motion.div>

                {/* Control Panel */}
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

                            {/* Enhanced benchmark description */}
                            <div className="p-4 bg-amber-50 rounded-lg">
                                <h3 className="text-amber-700 text-base font-medium mb-2">Benchmark với Entity Extraction</h3>
                                <p className="text-sm text-gray-600 mb-3">
                                    Đánh giá hiệu suất của 4 phương pháp khác nhau với entity extraction và nhiều metrics.
                                </p>

                                <div className="mb-3 text-xs text-gray-600">
                                    <div>• Current System: RAG với ChromaDB + Gemini</div>
                                    <div>• LangChain: Similarity search + Gemini</div>
                                    <div>• Haystack: BM25 retrieval + Gemini</div>
                                    <div>• ChatGPT: GPT-4o với cùng context</div>
                                </div>

                                <div className="mb-3 text-xs text-gray-600">
                                    <div><strong>Metrics:</strong> Cosine Similarity + Entity Similarity + Retrieval Accuracy + Processing Time</div>
                                    <div><strong>Entity Extraction:</strong> Tiền, Đối tượng, Điều kiện, Thủ tục, Thời hạn, Cơ quan, Văn bản</div>
                                    <div><strong>Optimization:</strong> 0.5s delay giữa API calls, 1s delay giữa câu hỏi</div>
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
                                            <Activity size={16} className="mr-2" />
                                            <span>Chạy benchmark với entity extraction</span>
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