import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Dashboard from './pages/Dashboard';
import VMDetails from './pages/VMDetails';
import AlertRulesConfig from './components/AlertRulesConfig';
import './index.css';

function App() {
  return (
    <Router>
      <Navbar />
      <div className="container">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/vm/:vmId" element={<VMDetails />} />
          <Route path="/alert-rules" element={<AlertRulesConfig />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
