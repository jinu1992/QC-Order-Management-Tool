import React, { useState, useMemo, useEffect, useCallback } from 'react';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import SummaryCard from './components/SummaryCard';
import PoTable from './components/PoTable';
import SalesOrderTable from './components/SalesOrderTable';
import AppointmentManager from './components/AppointmentManager';
import AdminPanel from './components/AdminPanel';
import FinanceManager from './components/FinanceManager';
import InventoryManager from './components/InventoryManager';
import ReportsManager from './components/ReportsManager';
import FileUploader from './components/FileUploader';
import ToastContainer from './components/ToastContainer';
import { XIcon, QuestionMarkCircleIcon, RefreshIcon } from './components/icons/Icons';
import { initialRolePermissions } from './data/mockData';
import { type PurchaseOrder, POStatus, ActivityLog, NotificationItem, ViewType, User, RolePermissions, InventoryItem, ChannelConfig } from './types';
import { fetchPurchaseOrders, fetchInventoryFromSheet, fetchChannelConfigs, fetchUsers } from './services/api';

// Default user to bypass login
const defaultUser: User = {
    id: 'admin-user-01',
    name: 'Cubelelo Admin',
    email: 'admin@cubelelo.com',
    contactNumber: '9999999999',
    role: 'Admin',
    avatarInitials: 'AD',
    isInitialized: true
};

const App: React.FC = () => {
  const [isSidebarOpen, setSidebarOpen] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [lastSynced, setLastSynced] = useState<number>(0);
  
  // Set default user immediately
  const [currentUser, setCurrentUser] = useState<User | null>(defaultUser);
  const [isAuthChecked, setIsAuthChecked] = useState(true);

  const [users, setUsers] = useState<User[]>([]);
  const [rolePermissions] = useState<RolePermissions>(initialRolePermissions);

  const [activeView, setActiveView] = useState<ViewType>('Dashboard');
  const [activeFilter, setActiveFilter] = useState('New POs');
  const [adminTab, setAdminTab] = useState<'users' | 'roles' | 'channels' | 'integrations' | 'logs'>('users');
  
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [channelConfigs, setChannelConfigs] = useState<ChannelConfig[]>([]);

  const [logs, setLogs] = useState<ActivityLog[]>([
    { id: '1', user: 'System', action: 'Init', details: 'System initialized.', timestamp: new Date().toLocaleString() }
  ]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [toasts, setToasts] = useState<NotificationItem[]>([]);

  const handleLogout = () => {
    setActiveView('Dashboard');
  };

  const toggleSidebar = () => setSidebarOpen(!isSidebarOpen);

  const addLog = useCallback((action: string, details: string) => {
    const newLog: ActivityLog = {
        id: Date.now().toString(),
        user: currentUser?.name || 'System', 
        action,
        details,
        timestamp: new Date().toLocaleString()
    };
    setLogs(prev => [newLog, ...prev]);
  }, [currentUser]);

  const addNotification = useCallback((message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info') => {
    const newNotification: NotificationItem = {
        id: Date.now().toString(),
        message,
        timestamp: new Date().toLocaleTimeString(),
        read: false,
        type
    };
    setNotifications(prev => [newNotification, ...prev]);
    setToasts(prev => [...prev, newNotification]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const refreshData = useCallback(async (force = false) => {
      if (!force && purchaseOrders.length > 0 && Date.now() - lastSynced < 1800000) return; 

      setIsLoading(true);
      try {
          const [poData, invData, channelData, userData] = await Promise.all([
              fetchPurchaseOrders(),
              fetchInventoryFromSheet(),
              fetchChannelConfigs(),
              fetchUsers()
          ]);

          if (poData.length > 0) setPurchaseOrders(poData);
          if (invData.length > 0) setInventoryItems(invData);
          if (channelData.length > 0) setChannelConfigs(channelData);
          if (userData.length > 0) setUsers(userData);

          setLastSynced(Date.now());
      } catch (e) {
          addNotification('Failed to sync data.', 'error');
      } finally {
          setIsLoading(false);
      }
  }, [lastSynced, purchaseOrders.length, addNotification]);

  useEffect(() => {
    if (currentUser) {
        refreshData();
        const intervalId = setInterval(() => refreshData(true), 30 * 60 * 1000);
        return () => clearInterval(intervalId);
    }
  }, [refreshData, currentUser]);

  // Handle section-specific default filters when activeView changes
  useEffect(() => {
    if (activeView === 'Purchase Orders') {
      setActiveFilter('New POs');
    } else if (activeView === 'Sales Orders') {
      setActiveFilter('All POs');
    }
  }, [activeView]);

  const getCalculatedStatus = (po: PurchaseOrder): POStatus => {
    const items = po.items || [];
    const activeItems = items.filter(i => (i.itemStatus || '').toLowerCase() !== 'cancelled');
    const pushedItems = activeItems.filter(i => !!i.eeOrderRefId);
    
    const rawStatus = String(po.status || '').trim().toLowerCase();

    // 1. Check if all items are explicitly cancelled or whole PO cancelled
    if (rawStatus === 'cancelled' || (items.length > 0 && activeItems.length === 0)) return POStatus.Cancelled;
    
    // 2. Below threshold
    if (rawStatus === 'below threshold') return POStatus.BelowThreshold;

    // 3. Pushed logic (Ignoring cancelled items)
    if (activeItems.length > 0 && pushedItems.length === activeItems.length) return POStatus.Pushed;
    if (pushedItems.length > 0) return POStatus.PartiallyProcessed;

    // 4. Other workflow statuses
    if (rawStatus === 'confirmed' || rawStatus === 'confirmed to send') return POStatus.ConfirmedToSend;
    if (rawStatus === 'waiting for confirmation') return POStatus.WaitingForConfirmation;
    
    return POStatus.NewPO;
  };

  const summaryData = useMemo(() => {
    const totalActiveCount = purchaseOrders.filter(p => {
        const status = getCalculatedStatus(p);
        return status !== POStatus.Closed && status !== POStatus.Cancelled;
    }).length;
    
    const pushed = purchaseOrders.filter(p => getCalculatedStatus(p) === POStatus.Pushed).length;
    const partiallyPushed = purchaseOrders.filter(p => getCalculatedStatus(p) === POStatus.PartiallyProcessed).length;

    return [
      { title: 'Total Active POs', value: totalActiveCount.toString(), changeText: 'Across all stages', color: 'blue', targetView: 'Purchase Orders', targetFilter: 'All POs' },
      { title: 'Fully Pushed', value: pushed.toString(), changeText: 'To EasyEcom', color: 'green', targetView: 'Purchase Orders', targetFilter: 'Pushed POs' },
      { title: 'Partially Pushed', value: partiallyPushed.toString(), changeText: 'Pending items', color: 'yellow', targetView: 'Purchase Orders', targetFilter: 'Partially Pushed POs' },
    ];
  }, [purchaseOrders]);

  const tabCounts = useMemo(() => {
    const counts = { 
        'All POs': purchaseOrders.length, 
        'New POs': 0, 
        'Below Threshold POs': 0, 
        'Pushed POs': 0, 
        'Partially Pushed POs': 0, 
        'Cancelled POs': 0 
    };
    purchaseOrders.forEach(po => {
        const status = getCalculatedStatus(po);
        if (status === POStatus.NewPO || status === POStatus.ConfirmedToSend || status === POStatus.WaitingForConfirmation) counts['New POs']++;
        else if (status === POStatus.BelowThreshold) counts['Below Threshold POs']++;
        else if (status === POStatus.Pushed) counts['Pushed POs']++;
        else if (status === POStatus.PartiallyProcessed) counts['Partially Pushed POs']++;
        else if (status === POStatus.Cancelled) counts['Cancelled POs']++;
    });
    return counts;
  }, [purchaseOrders]);
  
  const handleCardClick = (view: ViewType, filter?: string) => {
      if (currentUser && rolePermissions[currentUser.role]?.includes(view)) {
          setActiveView(view);
          if (filter) setActiveFilter(filter);
      } else {
          addNotification(`Access Denied.`, 'error');
      }
  };

  const renderContent = () => {
    if (!currentUser) return null;
    if (isLoading && purchaseOrders.length === 0) {
        return <div className="flex-1 flex flex-col items-center justify-center p-8"><RefreshIcon className="h-12 w-12 text-partners-green animate-spin mb-4" /><p className="text-gray-600 font-bold text-lg">Syncing Dashboard...</p></div>;
    }

    switch (activeView) {
        case 'Dashboard':
            return (
                <div className="p-4 sm:p-6 lg:p-8 flex-1">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {summaryData.map((card, index) => (
                            <SummaryCard key={index} {...card as any} onClick={() => handleCardClick(card.targetView as ViewType, card.targetFilter)} />
                        ))}
                    </div>
                </div>
            );
        case 'Purchase Orders':
            return (
                <div className="p-4 sm:p-6 lg:p-8 flex-1">
                    <PoTable activeFilter={activeFilter} setActiveFilter={setActiveFilter} purchaseOrders={purchaseOrders} setPurchaseOrders={setPurchaseOrders} tabCounts={tabCounts} addLog={addLog} addNotification={addNotification} onSync={() => refreshData(true)} isSyncing={isLoading} channelConfigs={channelConfigs} />
                </div>
            );
        case 'File Uploader':
            return <FileUploader currentUser={currentUser} addLog={addLog} addNotification={addNotification} />;
        case 'Inventory': return <InventoryManager addLog={addLog} inventoryItems={inventoryItems} setInventoryItems={setInventoryItems} onSync={() => refreshData(true)} isSyncing={isLoading} />;
        case 'Finance': return <FinanceManager purchaseOrders={purchaseOrders} setPurchaseOrders={setPurchaseOrders} addLog={addLog} />;
        case 'Reports': return <ReportsManager purchaseOrders={purchaseOrders} inventoryItems={inventoryItems} />;
        case 'Appointments':
            return <AppointmentManager purchaseOrders={purchaseOrders} setPurchaseOrders={setPurchaseOrders} addLog={addLog} addNotification={addNotification} />;
        case 'Sales Orders':
             return (
                <div className="p-4 sm:p-6 lg:p-8 flex-1">
                    <SalesOrderTable activeFilter={activeFilter} setActiveFilter={setActiveFilter} purchaseOrders={purchaseOrders} setPurchaseOrders={setPurchaseOrders} tabCounts={tabCounts} addLog={addLog} addNotification={addNotification} onSync={() => refreshData(true)} isSyncing={isLoading} />
                </div>
            );
        case 'Admin': return (
            <AdminPanel logs={logs} users={users} setUsers={setUsers} rolePermissions={rolePermissions} setRolePermissions={() => {}} addLog={addLog} currentUser={currentUser} channelConfigs={channelConfigs} onSync={() => refreshData(true)} activeTab={adminTab} setActiveTab={setAdminTab} />
        );
        default: return <div className="p-8 text-center text-gray-500">Section Under Construction</div>;
    }
  };

  if (!isAuthChecked || !currentUser) return null;

  return (
    <div className="flex h-screen bg-partners-gray-bg font-sans overflow-hidden">
      <ToastContainer toasts={toasts} onRemove={removeToast} />
      
      {/* Sidebar Container */}
      <div 
        className={`fixed lg:relative inset-y-0 left-0 z-30 transition-all duration-300 ease-in-out border-r border-partners-border bg-white ${
          isSidebarOpen ? 'w-64 translate-x-0' : 'w-0 -translate-x-full'
        }`}
      >
        <div className={`w-64 h-full ${!isSidebarOpen && 'invisible'}`}>
          <Sidebar activeView={activeView} setActiveView={setActiveView} currentUser={currentUser} permissions={rolePermissions} onLogout={handleLogout} />
        </div>
      </div>

      {/* Main Content Container */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto transition-all duration-300 ease-in-out">
        <Header 
          notifications={notifications} 
          onMarkRead={() => {}} 
          onClearAll={() => {}} 
          onViewLogs={() => { setActiveView('Admin'); setAdminTab('logs'); }} 
          activeView={activeView}
          onToggleSidebar={toggleSidebar}
        />
        {renderContent()}
      </main>

      <button className="fixed bottom-6 right-6 bg-green-600 text-white p-3 rounded-full shadow-lg hover:bg-green-700 transition-all hover:scale-110 flex items-center gap-2 z-40">
        <QuestionMarkCircleIcon className="h-6 w-6" />
        <span className="font-bold text-sm pr-1">Help</span>
      </button>
    </div>
  );
};

export default App;
