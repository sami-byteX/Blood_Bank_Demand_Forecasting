import { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Sidebar from '../components/Sidebar';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';

export default function DashboardLayout() {
  const { user } = useAuth();
  const [pendingCount, setPendingCount] = useState(0);

  // Load pending request count for Staff/Admin sidebar badge
  useEffect(() => {
    if (!user || user.role === 'donor') return;
    api.get('/requests/')
      .then((r) => {
        const list = r.data?.results ?? r.data;
        const pending = Array.isArray(list) ? list.filter((req) => req.status === 'pending').length : 0;
        setPendingCount(pending);
      })
      .catch(() => {});
  }, [user]);

  return (
    <>
      <Sidebar pendingCount={pendingCount} />
      <div className="bb-main">
        <Navbar />
        <div className="bb-content">
          <Outlet />
        </div>
      </div>
    </>
  );
}
