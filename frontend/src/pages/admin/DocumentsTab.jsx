import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { FileText, Upload, Eye, Trash2, Calendar, FileSymlink } from 'lucide-react';
import { formatDate } from '../../utils/formatUtils';
import { 
  fadeInVariants, 
  AdminLoadingSpinner, 
  AdminEmptyState, 
  AdminSectionHeader,
  AdminSearchInput,
  AdminActionButton 
} from '../../components/admin/SharedAdminComponents';

const DocumentsTab = ({
  documents, isLoading, documentFilter, setDocumentFilter,
  documentFiles, setDocumentFiles, uploadMetadata, setUploadMetadata,
  handleUploadDocument, handleDeleteDocument
}) => {

  const filteredDocuments = documents.filter(doc => 
    doc.doc_id.toLowerCase().includes(documentFilter.toLowerCase()) ||
    doc.doc_title?.toLowerCase().includes(documentFilter.toLowerCase())
  );

  const DocumentItem = ({ document }) => (
    <div className="border border-gray-200 rounded-lg hover:shadow-sm transition-shadow">
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
            <button className="p-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors">
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
  );

  const UploadForm = () => (
    <form onSubmit={handleUploadDocument}>
      <div className="space-y-4">
        {[
          { field: 'doc_id', label: 'Mã văn bản', placeholder: 'Ví dụ: 101_2018_TT_BTC', required: true },
          { field: 'doc_title', label: 'Tiêu đề', placeholder: 'Nhập tiêu đề văn bản', required: true },
          { field: 'effective_date', label: 'Ngày hiệu lực', placeholder: 'DD-MM-YYYY', required: true }
        ].map(({ field, label, placeholder, required }) => (
          <div key={field}>
            <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
            <input
              type="text"
              value={uploadMetadata[field]}
              onChange={(e) => setUploadMetadata({ ...uploadMetadata, [field]: e.target.value })}
              placeholder={placeholder}
              className="w-full py-2 px-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm"
              required={required}
            />
          </div>
        ))}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Loại văn bản</label>
          <select
            value={uploadMetadata.doc_type}
            onChange={(e) => setUploadMetadata({ ...uploadMetadata, doc_type: e.target.value })}
            className="w-full py-2 px-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm bg-white"
          >
            {['Thông tư', 'Nghị định', 'Quyết định', 'Pháp lệnh', 'Luật'].map(type => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Tệp chunks</label>
          <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-lg">
            <div className="space-y-1 text-center">
              <svg className="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48">
                <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <div className="flex text-sm text-gray-600">
                <label htmlFor="file-upload" className="relative cursor-pointer bg-white rounded-md font-medium text-green-600 hover:text-green-500">
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
              <p className="text-xs text-gray-500">Tệp Markdown (.md)</p>
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
        <AdminActionButton
          type="submit"
          loading={isLoading}
          icon={Upload}
          className="w-full"
        >
          Tải lên văn bản
        </AdminActionButton>
      </div>
    </form>
  );

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
          <AdminSectionHeader 
            icon={FileText}
            title="Danh sách văn bản"
            rightContent={
              <AdminSearchInput 
                placeholder="Tìm kiếm văn bản..."
                value={documentFilter}
                onChange={(e) => setDocumentFilter(e.target.value)}
              />
            }
          />

          <div className="p-5">
            {isLoading ? (
              <AdminLoadingSpinner />
            ) : filteredDocuments.length > 0 ? (
              <div className="space-y-4">
                {filteredDocuments.map((document) => (
                  <DocumentItem key={document.doc_id} document={document} />
                ))}
              </div>
            ) : (
              <AdminEmptyState 
                icon={FileText}
                title="Không tìm thấy văn bản nào"
                description={documentFilter ? `Không có kết quả cho "${documentFilter}"` : "Chưa có văn bản trong hệ thống"}
              />
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
          <AdminSectionHeader 
            icon={Upload}
            title="Tải lên văn bản"
          />
          <div className="p-5">
            <UploadForm />
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default DocumentsTab;