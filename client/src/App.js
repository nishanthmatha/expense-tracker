// src/App.js
import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import './index.css';
import ConnectPage from './pages/ConnectPage';
import DashboardPage from './pages/DashboardPage';
import CallbackPage from './pages/CallbackPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/"           element={<ConnectPage />} />
        <Route path="/callback"   element={<CallbackPage />} />
        <Route path="/dashboard"  element={<DashboardPage />} />
      </Routes>
    </BrowserRouter>
  );
}
