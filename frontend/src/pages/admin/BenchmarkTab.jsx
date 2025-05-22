import React from 'react';
import { motion } from 'framer-motion';
import { BarChart2, Activity, Eye, Download, Upload, Info } from 'lucide-react';
import Swal from 'sweetalert2';
import { formatDate } from '../../utils/formatUtils';

const BenchmarkTab = ({
    benchmarkResults,
    isLoading,
    runningBenchmark,
    benchmarkProgress,
    handleRunBenchmark
}) => {
    const fadeInVariants = {
        hidden: { opacity: 0, y: 10 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.3 } }
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
                            Kết quả Benchmark
                        </h2>
                    </div>

                    <div className="p-5">
                        {isLoading ? (
                            <div className="py-4 flex justify-center">
                                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-green-500"></div>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {benchmarkResults.length > 0 ? (
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
                                                            onClick={() => window.open(`http://localhost:8001/benchmark-results/${result.file_name}`, '_blank')}
                                                        >
                                                            <Eye size={14} />
                                                        </button>
                                                        <button
                                                            className="p-1.5 rounded-lg bg-green-50 text-green-600 hover:bg-green-100 transition-colors"
                                                            onClick={() => window.open(`http://localhost:8001/benchmark-results/${result.file_name}`, '_blank', 'download')}
                                                        >
                                                            <Download size={14} />
                                                        </button>
                                                    </div>
                                                </div>

                                                {result.avg_retrieval_score !== undefined && (
                                                    <div className="mt-3">
                                                        <div className="flex justify-between text-xs text-gray-600 mb-1">
                                                            <span>Độ chính xác trung bình:</span>
                                                            <span>{(result.avg_retrieval_score * 100).toFixed(2)}%</span>
                                                        </div>
                                                        <div className="w-full bg-gray-200 rounded-full h-2">
                                                            <div
                                                                className="bg-green-600 h-2 rounded-full"
                                                                style={{ width: `${result.avg_retrieval_score * 100}%` }}
                                                            ></div>
                                                        </div>
                                                    </div>
                                                )}

                                                <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
                                                    <div className="flex items-center">
                                                        <Activity size={12} className="mr-1" />
                                                        <span>Kích thước: {result.size_kb} KB</span>
                                                    </div>
                                                    {result.questions_count !== undefined && (
                                                        <div className="flex items-center">
                                                            <Info size={12} className="mr-1" />
                                                            <span>{result.questions_count} câu hỏi</span>
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

                {/* Run Benchmark */}
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
                            <div className="p-4 bg-amber-50 rounded-lg">
                                <h3 className="text-amber-700 text-base font-medium mb-2">Benchmark mặc định</h3>
                                <p className="text-sm text-gray-600 mb-3">
                                    Chạy benchmark với bộ câu hỏi mặc định để đánh giá hiệu suất của hệ thống.
                                </p>

                                {runningBenchmark ? (
                                    <div className="space-y-3">
                                        <div className="w-full bg-gray-200 rounded-full h-2">
                                            <div
                                                className="bg-green-600 h-2 rounded-full transition-all duration-500"
                                                style={{ width: `${benchmarkProgress}%` }}
                                            ></div>
                                        </div>
                                        <div className="flex justify-between text-xs text-gray-600">
                                            <span>Đang chạy benchmark...</span>
                                            <span>{Math.round(benchmarkProgress)}%</span>
                                        </div>
                                    </div>
                                ) : (
                                    <button
                                        onClick={handleRunBenchmark}
                                        disabled={isLoading}
                                        className="flex items-center justify-center w-full py-2 px-4 bg-gradient-to-r from-amber-500 to-orange-600 text-white hover:opacity-90 transition-opacity rounded-lg text-sm font-medium"
                                    >
                                        <BarChart2 size={16} className="mr-2" />
                                        <span>Chạy benchmark</span>
                                    </button>
                                )}
                            </div>

                            <div className="p-4 bg-blue-50 rounded-lg">
                                <h3 className="text-blue-700 text-base font-medium mb-2">Benchmark tùy chỉnh</h3>
                                <p className="text-sm text-gray-600 mb-3">
                                    Tải lên file benchmark tùy chỉnh để đánh giá hệ thống với các trường hợp riêng.
                                </p>

                                <div className="mt-1 flex justify-center px-6 pt-3 pb-4 border-2 border-blue-300 border-dashed rounded-lg">
                                    <div className="space-y-1 text-center">
                                        <svg className="mx-auto h-8 w-8 text-blue-400" stroke="currentColor" fill="none" viewBox="0 0 48 48">
                                            <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                        </svg>
                                        <div className="flex text-sm text-gray-600 justify-center">
                                            <label htmlFor="benchmark-upload" className="relative cursor-pointer bg-white rounded-md font-medium text-blue-600 hover:text-blue-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-blue-500">
                                                <span>Tải lên file</span>
                                                <input id="benchmark-upload" name="benchmark-upload" type="file" className="sr-only" accept=".json" />
                                            </label>
                                        </div>
                                        <p className="text-xs text-gray-500">
                                            Định dạng JSON
                                        </p>
                                    </div>
                                </div>

                                <button
                                    className="mt-3 flex items-center justify-center w-full py-2 px-4 bg-white border border-blue-600 text-blue-600 hover:bg-blue-50 transition-colors rounded-lg text-sm font-medium"
                                    disabled
                                >
                                    <Upload size={16} className="mr-2" />
                                    <span>Tải lên & chạy</span>
                                </button>
                            </div>

                            <div className="mt-4">
                                <h3 className="text-sm font-medium text-gray-700 mb-2">Thống kê</h3>
                                <div className="space-y-2">
                                    <div className="flex justify-between">
                                        <span className="text-sm text-gray-600">Kết quả benchmark:</span>
                                        <span className="text-sm font-medium text-gray-900">{benchmarkResults.length}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-sm text-gray-600">Trung bình độ chính xác:</span>
                                        <span className="text-sm font-medium text-gray-900">
                                            {benchmarkResults.length > 0 && benchmarkResults[0].avg_retrieval_score !== undefined
                                                ? `${(benchmarkResults[0].avg_retrieval_score * 100).toFixed(2)}%`
                                                : 'N/A'}
                                        </span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-sm text-gray-600">Thời gian chạy gần nhất:</span>
                                        <span className="text-sm font-medium text-gray-900">
                                            {benchmarkResults.length > 0 ? formatDate(benchmarkResults[0].created_at) : 'N/A'}
                                        </span>
                                    </div>
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