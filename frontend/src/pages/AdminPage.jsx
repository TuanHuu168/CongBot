import React from 'react';
import { motion } from 'framer-motion';
import { RefreshCw } from 'lucide-react';
import { useAdminLogic } from '../hooks/useAdminLogic';
import { formatDate, pageVariants } from '../utils/formatUtils';
import TopNavBar from '../components/common/TopNavBar';
import AdminSidebar from '../components/admin/AdminSidebar';
import ErrorMessage from '../components/common/ErrorMessage';
import DashboardTab from './admin/DashboardTab';
import UsersTab from './admin/UsersTab';
import DocumentsTab from './admin/DocumentsTab';
import CacheTab from './admin/CacheTab';
import BenchmarkTab from './admin/BenchmarkTab';

const AdminPage = () => {
  const {
    activeTab, setActiveTab, systemStats, users, documents, benchmarkResults,
    isLoading, refreshing, error, setError,
    documentFilter, setDocumentFilter, documentFiles, setDocumentFiles,
    uploadMetadata, setUploadMetadata,
    runningBenchmark, benchmarkProgress,
    invalidateDocId, setInvalidateDocId, searchCacheKeyword, setSearchCacheKeyword,
    handleUploadDocument, handleDeleteDocument, handleClearCache,
    handleInvalidateDocCache, handleSearchCache, handleRunBenchmark,
    handleLogout, handleRefresh
  } = useAdminLogic();

  const getTabTitle = () => {
    const titles = {
      dashboard: 'Dashboard',
      users: 'Quản lý người dùng',
      documents: 'Quản lý văn bản',
      cache: 'Quản lý cache',
      benchmark: 'Benchmark'
    };
    return titles[activeTab] || 'Admin Panel';
  };

  const renderActiveTab = () => {
    const commonProps = { isLoading };
    
    switch (activeTab) {
      case 'dashboard':
        return (
          <DashboardTab 
            {...commonProps}
            systemStats={systemStats}
            users={users}
            documents={documents}
            benchmarkResults={benchmarkResults}
          />
        );
      case 'users':
        return <UsersTab {...commonProps} users={users} />;
      case 'documents':
        return (
          <DocumentsTab 
            {...commonProps}
            documents={documents}
            documentFilter={documentFilter}
            setDocumentFilter={setDocumentFilter}
            documentFiles={documentFiles}
            setDocumentFiles={setDocumentFiles}
            uploadMetadata={uploadMetadata}
            setUploadMetadata={setUploadMetadata}
            handleUploadDocument={handleUploadDocument}
            handleDeleteDocument={handleDeleteDocument}
          />
        );
      case 'cache':
        return (
          <CacheTab 
            {...commonProps}
            systemStats={systemStats}
            invalidateDocId={invalidateDocId}
            setInvalidateDocId={setInvalidateDocId}
            searchCacheKeyword={searchCacheKeyword}
            setSearchCacheKeyword={setSearchCacheKeyword}
            handleClearCache={handleClearCache}
            handleInvalidateDocCache={handleInvalidateDocCache}
            handleSearchCache={handleSearchCache}
          />
        );
      case 'benchmark':
        return (
          <BenchmarkTab 
            {...commonProps}
            benchmarkResults={benchmarkResults}
            runningBenchmark={runningBenchmark}
            benchmarkProgress={benchmarkProgress}
            handleRunBenchmark={handleRunBenchmark}
          />
        );
      default:
        return <DashboardTab {...commonProps} systemStats={systemStats} users={users} documents={documents} benchmarkResults={benchmarkResults} />;
    }
  };

  return (
    <motion.div
      className="flex h-screen bg-gradient-to-br from-gray-50 to-slate-100"
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
    >
      {error && <ErrorMessage message={error} onClose={() => setError(null)} />}

      <AdminSidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        handleLogout={handleLogout} 
      />

      <div className="ml-64 flex-1 overflow-x-hidden">
        <TopNavBar 
          title={getTabTitle()}
          customRight={
            <div className="flex items-center space-x-4">
              <button
                onClick={handleRefresh}
                className={`flex items-center text-gray-500 hover:text-gray-700 ${refreshing ? 'animate-spin' : ''}`}
              >
                <RefreshCw size={18} />
              </button>

              <div className="h-6 border-l border-gray-300"></div>

              <div className="text-sm text-gray-600">
                Cập nhật gần nhất: {formatDate(new Date().toISOString())}
              </div>
            </div>
          }
        />

        {renderActiveTab()}
      </div>
    </motion.div>
  );
};

export default AdminPage;