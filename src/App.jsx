import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ChatInterface from './pages/ChatInterface';
// import ChatHistoryPage from './pages/ChatHistoryPage';

function App() {
  return (
    <Router>
      <div className="App">
        <Routes>
          <Route path="/" element={<LoginPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/chat" element={<ChatInterface />} />
          {/* <Route path="/history" element={<ChatHistoryPage />} /> */}
        </Routes>
      </div>
    </Router>
  );
}

export default App;
