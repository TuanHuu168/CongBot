import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Activity, Eye, Download, Upload } from 'lucide-react';
import { formatDate } from '../../utils/formatUtils';
import { getApiBaseUrl } from '../../apiService';
import { 
  fadeInVariants, 
  AdminLoadingSpinner, 
  AdminEmptyState, 
  AdminSectionHeader,
  AdminActionButton 
} from '../../components/admin/SharedAdminComponents';
import axios from 'axios';

const BenchmarkTab = ({ benchmarkResults, isLoading }) => {
  const [runningBenchmark, setRunningBenchmark] = useState(false);
  const [benchmarkProgress, setBenchmarkProgress] = useState(0);
  const [currentBenchmarkId, setCurrentBenchmarkId] = useState(null);
  const [benchmarkStatus, setBenchmarkStatus] = useState('idle');
  const [benchmarkPhase, setBenchmarkPhase] = useState('');
  const [selectedBenchmarkFile, setSelectedBenchmarkFile] = useState('benchmark.json');
  const [uploadedFiles, setUploadedFiles] = useState([]);

  const API_BASE_URL = getApiBaseUrl();

  useEffect(() => {
    loadBenchmarkFiles();
  }, []);

  const loadBenchmarkFiles = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/benchmark-files`);
      setUploadedFiles(response.data.files || []);
    } catch (error) {
      console.error('Lỗi khi tải danh sách file benchmark:', error);
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
          setBenchmarkPhase(data.phase || '');

          if (data.status === 'completed') {
            setRunningBenchmark(false);
            clearInterval(interval);
          } else if (data.status === 'failed') {
            setRunningBenchmark(false);
            clearInterval(interval);
          }
        } catch (error) {
          console.error('Lỗi khi lấy tiến trình benchmark:', error);
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

  const handleStartBenchmark = async () => {
    try {
      setRunningBenchmark(true);
      setBenchmarkProgress(0);
      setBenchmarkStatus('running');
      setBenchmarkPhase('starting');

      const response = await axios.post(`${API_BASE_URL}/run-benchmark`, {
        file_path: selectedBenchmarkFile,
        output_dir: "benchmark_results"
      });

      setCurrentBenchmarkId(response.data.benchmark_id);
    } catch (error) {
      console.error('Lỗi khi khởi động benchmark:', error);
      setRunningBenchmark(false);
    }
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (!file.name.endsWith('.json')) {
      alert('Chỉ hỗ trợ tải lên file JSON');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await axios.post(`${API_BASE_URL}/upload-benchmark`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      setSelectedBenchmarkFile(response.data.filename);
      loadBenchmarkFiles();
      event.target.value = '';
    } catch (error) {
      console.error('Lỗi khi tải file:', error);
    }
  };

  const ProgressDisplay = () => (
    runningBenchmark && (
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
          <span className="font-medium text-blue-600">{getPhaseDisplay(benchmarkPhase)}</span>
        </div>
        
        <div className="mt-2 text-xs text-blue-600">
          File: {selectedBenchmarkFile} | Models: Current + LangChain + Haystack + ChatGPT
        </div>
      </div>
    )
  );

  const BenchmarkResults = () => (
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
                  <button className="p-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors" title="Xem chi tiết">
                    <Eye size={14} />
                  </button>
                  <button className="p-1.5 rounded-lg bg-green-50 text-green-600 hover:bg-green-100 transition-colors" title="Tải xuống">
                    <Download size={14} />
                  </button>
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
                <span>Kích thước: {result.size_kb} KB</span>
                {result.questions_count && <span>{result.questions_count} Câu hỏi</span>}
              </div>
            </div>
          </div>
        ))
      ) : (
        <AdminEmptyState 
          icon={Activity}
          title="Chưa có kết quả benchmark nào"
        />
      )}
    </div>
  );

  const ControlPanel = () => (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Chọn file benchmark</label>
        <select
          value={selectedBenchmarkFile}
          onChange={(e) => setSelectedBenchmarkFile(e.target.value)}
          className="block w-full py-2 px-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm bg-white"
        >
          <option value="benchmark.json">benchmark.json (mặc định)</option>
          {uploadedFiles.map((file) => (
            <option key={file.filename} value={file.filename}>
              {file.filename} ({file.questions_count} câu hỏi)
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Tải file mới</label>
        <input
          type="file"
          accept=".json"
          onChange={handleFileUpload}
          className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-green-50 file:text-green-700 hover:file:bg-green-100"
        />
      </div>

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

        <AdminActionButton
          onClick={handleStartBenchmark}
          loading={runningBenchmark}
          icon={Activity}
          className="w-full"
          variant="secondary"
        >
          Chạy benchmark với entity extraction
        </AdminActionButton>
      </div>

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
        </div>
      </div>
    </div>
  );

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
          <AdminSectionHeader 
            icon={Activity}
            title="Kết quả Benchmark với Entity Extraction"
          />

          <div className="p-5">
            <ProgressDisplay />
            {isLoading ? <AdminLoadingSpinner /> : <BenchmarkResults />}
          </div>
        </motion.div>

        {/* Control Panel */}
        <motion.div
          className="bg-white rounded-xl shadow-sm mb-6 border border-gray-100"
          variants={fadeInVariants}
          initial="hidden"
          animate="visible"
        >
          <AdminSectionHeader 
            icon={Activity}
            title="Chạy Benchmark"
          />
          <div className="p-5">
            <ControlPanel />
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default BenchmarkTab;