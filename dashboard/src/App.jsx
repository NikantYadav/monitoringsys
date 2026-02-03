import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Dashboard from './pages/Dashboard';
import VMDetails from './pages/VMDetails'; // Will create next
import './index.css';

function App() {
  return (
    <Router>
      <Navbar />
      <div className="container">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/vm/:vmId" element={<VMDetails />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
