import React from 'react';
import { Trash2, Eye, Calendar, FileSymlink } from 'lucide-react';
import { formatDate } from '../../utils/formatUtils';

const DocumentItem = ({ document, onDelete, onView }) => {
    return (
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
                        <button
                            className="p-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
                            onClick={() => onView && onView(document.doc_id)}
                        >
                            <Eye size={14} />
                        </button>
                        <button
                            className="p-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
                            onClick={() => onDelete && onDelete(document.doc_id)}
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
};

export default DocumentItem;