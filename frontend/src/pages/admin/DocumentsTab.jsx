import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Search, Trash2, Upload, FileText, Eye, Calendar, FileSymlink } from 'lucide-react';
import Swal from 'sweetalert2';
import { formatDate } from '../../utils/formatUtils';

const DocumentsTab = ({
    documents,
    isLoading,
    documentFilter,
    setDocumentFilter,
    documentFiles,
    setDocumentFiles,
    uploadMetadata,
    setUploadMetadata,
    handleUploadDocument,
    handleDeleteDocument
}) => {
    const fadeInVariants = {
        hidden: { opacity: 0, y: 10 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.3 } }
    };

    return (
        <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Document List */}
                <motion.div
                    className="md:col-span-2 bg-white rounded-xl shadow-sm mb-6 border border-gray-100"
                    variants={fadeInVariants}
                    initial="hidden"
                    animate="visible"
                >
                    <div className="p-5 border-b border-gray-100 flex justify-between items-center">
                        <h2 className="text-lg font-semibold flex items-center">
                            <FileText size={18} className="text-green-600 mr-2" />
                            Danh sách văn bản
                        </h2>

                        <div className="flex items-center space-x-2">
                            <div className="relative">
                                <input
                                    type="text"
                                    placeholder="Tìm kiếm văn bản..."
                                    value={documentFilter}
                                    onChange={(e) => setDocumentFilter(e.target.value)}
                                    className="py-1.5 pl-8 pr-3 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                                />
                                <Search size={14} className="absolute left-2.5 top-1/2 transform -translate-y-1/2 text-gray-400" />
                            </div>
                        </div>
                    </div>

                    <div className="p-5">
                        {isLoading ? (
                            <div className="py-4 flex justify-center">
                                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-green-500"></div>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {documents
                                    .filter(doc => doc.doc_id.toLowerCase().includes(documentFilter.toLowerCase()) ||
                                        doc.doc_title?.toLowerCase().includes(documentFilter.toLowerCase()))
                                    .map((document) => (
                                        <div key={document.doc_id} className="border border-gray-200 rounded-lg hover:shadow-sm transition-shadow">
                                            <div className="p-4">
                                                <div className="flex justify-between items-start">
                                                    <div>
                                                        <h3 className="text-sm font-medium text-gray-900 flex items-center">
                                                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 mr-2">
                                                                {document.doc_type}
                                                            </span>
                                                            {document.doc_id}
                                                        </h3>
                                                        <p className="mt-1 text-sm text-gray-600">{document.doc_title}</p>
                                                    </div>
                                                    <div className="flex space-x-1">
                                                        <button
                                                            className="p-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
                                                            onClick={() => {/* View document */ }}
                                                        >
                                                            <Eye size={14} />
                                                        </button>
                                                        <button
                                                            className="p-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
                                                            onClick={() => handleDeleteDocument(document.doc_id)}
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </div>
                                                </div>

                                                <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
                                                    <div className="flex items-center">
                                                        <Calendar size={12} className="mr-1" />
                                                        <span>Ngày hiệu lực: {document.effective_date || 'Không xác định'}</span>
                                                    </div>
                                                    <div className="flex items-center">
                                                        <FileSymlink size={12} className="mr-1" />
                                                        <span>{document.chunks_count || 0} chunks</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}

                                {documents.filter(doc => doc.doc_id.toLowerCase().includes(documentFilter.toLowerCase()) ||
                                    doc.doc_title?.toLowerCase().includes(documentFilter.toLowerCase())).length === 0 && (
                                        <div className="py-10 text-center">
                                            <div className="inline-flex items-center justify-center h-12 w-12 rounded-full bg-gray-100 mb-3">
                                                <FileText size={24} className="text-gray-400" />
                                            </div>
                                            <p className="text-gray-500 text-sm">Không tìm thấy văn bản nào</p>
                                        </div>
                                    )}
                            </div>
                        )}
                    </div>
                </motion.div>

                {/* Upload Document */}
                <motion.div
                    className="bg-white rounded-xl shadow-sm mb-6 border border-gray-100"
                    variants={fadeInVariants}
                    initial="hidden"
                    animate="visible"
                >
                    <div className="p-5 border-b border-gray-100">
                        <h2 className="text-lg font-semibold flex items-center">
                            <Upload size={18} className="text-green-600 mr-2" />
                            Tải lên văn bản
                        </h2>
                    </div>

                    <div className="p-5">
                        <form onSubmit={handleUploadDocument}>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Mã văn bản
                                    </label>
                                    <input
                                        type="text"
                                        value={uploadMetadata.doc_id}
                                        onChange={(e) => setUploadMetadata({ ...uploadMetadata, doc_id: e.target.value })}
                                        placeholder="Ví dụ: 101_2018_TT_BTC"
                                        className="w-full py-2 px-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm"
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Loại văn bản
                                    </label>
                                    <select
                                        value={uploadMetadata.doc_type}
                                        onChange={(e) => setUploadMetadata({ ...uploadMetadata, doc_type: e.target.value })}
                                        className="w-full py-2 px-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm bg-white"
                                    >
                                        <option value="Thông tư">Thông tư</option>
                                        <option value="Nghị định">Nghị định</option>
                                        <option value="Quyết định">Quyết định</option>
                                        <option value="Pháp lệnh">Pháp lệnh</option>
                                        <option value="Luật">Luật</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Tiêu đề
                                    </label>
                                    <input
                                        type="text"
                                        value={uploadMetadata.doc_title}
                                        onChange={(e) => setUploadMetadata({ ...uploadMetadata, doc_title: e.target.value })}
                                        placeholder="Nhập tiêu đề văn bản"
                                        className="w-full py-2 px-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm"
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Ngày hiệu lực
                                    </label>
                                    <input
                                        type="text"
                                        value={uploadMetadata.effective_date}
                                        onChange={(e) => setUploadMetadata({ ...uploadMetadata, effective_date: e.target.value })}
                                        placeholder="DD-MM-YYYY"
                                        className="w-full py-2 px-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm"
                                        required
                                    />
                                    <p className="mt-1 text-xs text-gray-500">Định dạng: DD-MM-YYYY</p>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Phạm vi áp dụng
                                    </label>
                                    <select
                                        value={uploadMetadata.document_scope}
                                        onChange={(e) => setUploadMetadata({ ...uploadMetadata, document_scope: e.target.value })}
                                        className="w-full py-2 px-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm bg-white"
                                    >
                                        <option value="Quốc gia">Quốc gia</option>
                                        <option value="Địa phương">Địa phương</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Tệp chunks
                                    </label>
                                    <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-lg">
                                        <div className="space-y-1 text-center">
                                            <svg className="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48">
                                                <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                            </svg>
                                            <div className="flex text-sm text-gray-600">
                                                <label htmlFor="file-upload" className="relative cursor-pointer bg-white rounded-md font-medium text-green-600 hover:text-green-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-green-500">
                                                    <span>Tải tệp lên</span>
                                                    <input
                                                        id="file-upload"
                                                        name="file-upload"
                                                        type="file"
                                                        className="sr-only"
                                                        multiple
                                                        onChange={(e) => setDocumentFiles(Array.from(e.target.files))}
                                                        accept=".md,.txt"
                                                    />
                                                </label>
                                                <p className="pl-1">hoặc kéo và thả</p>
                                            </div>
                                            <p className="text-xs text-gray-500">
                                                Tệp Markdown (.md)
                                            </p>
                                        </div>
                                    </div>

                                    {documentFiles.length > 0 && (
                                        <div className="mt-2">
                                            <p className="text-xs font-medium text-gray-700">Đã chọn {documentFiles.length} tệp:</p>
                                            <ul className="mt-1 max-h-24 overflow-y-auto text-xs text-gray-500">
                                                {documentFiles.map((file, index) => (
                                                    <li key={index} className="truncate">{file.name}</li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="mt-6">
                                <button
                                    type="submit"
                                    disabled={isLoading}
                                    className="w-full inline-flex justify-center items-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-lg text-white bg-gradient-to-r from-green-600 to-teal-600 hover:from-green-700 hover:to-teal-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                                >
                                    {isLoading ? (
                                        <>
                                            <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-2"></div>
                                            <span>Đang tải lên...</span>
                                        </>
                                    ) : (
                                        <>
                                            <Upload size={16} className="mr-2" />
                                            <span>Tải lên văn bản</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </motion.div>
            </div>
        </div>
    );
};

export default DocumentsTab;