import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { ChatProvider } from './ChatContext';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ChatInterface from './pages/ChatInterface';
import ChatHistoryPage from './pages/ChatHistoryPage';
import ProfilePage from './pages/ProfilePage';
import LandingPage from './pages/LandingPage';

// Tạo wrapper component để có thể sử dụng useLocation
function AnimatedRoutes() {
  const location = useLocation();
  
  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/chat" element={<ChatInterface />} />
        <Route path="/history" element={<ChatHistoryPage />} />
        <Route path="/profile" element={<ProfilePage />} />
      </Routes>
    </AnimatePresence>
  );
}

function App() {
  return (
    <Router>
      <ChatProvider>
        <div className="App">
          <AnimatedRoutes />
        </div>
      </ChatProvider>
    </Router>
  );
}

export default App;