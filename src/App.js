import React, { useState, useEffect, useMemo, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getAnalytics, isSupported } from 'firebase/analytics';
import { 
  getFirestore, 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  onSnapshot, 
  query, 
  orderBy,
  deleteDoc
} from 'firebase/firestore';
import { 
  getAuth, 
  signInAnonymously, 
  onAuthStateChanged 
} from 'firebase/auth';
import { 
  Plus, 
  Search, 
  ClipboardList, 
  Truck, 
  CheckCircle, 
  FileText, 
  Package, 
  ChevronRight, 
  ArrowLeftRight, 
  User, 
  Building2, 
  Calendar, 
  Download, 
  Filter, 
  Loader2, 
  X, 
  AlertCircle, 
  Save, 
  Trash2, 
  EyeOff, 
  Eye, 
  Split, 
  Layers, 
  Target, 
  ShieldCheck, 
  Lock, 
  FileSpreadsheet
} from 'lucide-react';

/**
 * PRODUCTION CONFIGURATION
 * Optimized for GitHub, Firebase, and Azure Static Web Apps hosting.
 */

const firebaseConfig = {
  apiKey: "AIzaSyBOixLvmuEUCb-Tm-GlfszrrHWa8KjL5a0",
  authDomain: "sjsibt.firebaseapp.com",
  projectId: "sjsibt",
  storageBucket: "sjsibt.firebasestorage.app",
  messagingSenderId: "750662306150",
  appId: "1:750662306150:web:48c2b2d798f0f6431920a7",
  measurementId: "G-C7VKTZ5W5D"
};

// Initialize Firebase services
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Initialize Analytics conditionally
let analytics = null;
isSupported().then(yes => yes ? analytics = getAnalytics(app) : null);

// Fixed App ID for Firestore path compliance (Rule 1)
const APP_ID = 'sjsibt';

// Constants
const LOGISTIC_STATUSES = ['Requested', 'Accepted', 'Packed', 'Dispatched', 'Received'];
const BRANCHES = ['WC', 'NP', 'SSP', 'KT', 'ST'];
const UNITS = ['tablet', 'capsule', 'bottle', 'box', 'pcs'];
const SHEET_URL = "https://docs.google.com/spreadsheets/d/1lECgqYwshKlbAwRD3AA6dqjMo2XPqxOoI_NlenTy3ig/export?format=csv";

const COMPANY_NAME = "St. James' Settlement Community Pharmacy";

const BRANCH_INFO = {
  'WC': {
    fullName: "Philanthropic Community Pharmacy - WC",
    address: "O/B St. James Settlement, Room 8, 8/F, 85 Stone Nullah Lane, Wan Chai, Hong Kong",
    tel: "2831 3289"
  },
  'SSP': {
    fullName: "Philanthropic Community Pharmacy - SSP",
    address: "O/B St. James Settlement, Shop No. 7, G/F, High One Grand, 188 Fuk Wing Street, Sham Shui Po, Kowloon, HK",
    tel: "2389 9456"
  },
  'KT': {
    fullName: "Philanthropic Community Pharmacy - KT",
    address: "O/B St. James Settlement, Shop C1, 12/F, TG Place, Kwun Tong, Kowloon, Hong Kong",
    tel: "2116 4958"
  },
  'ST': {
    fullName: "Philanthropic Community Pharmacy - ST",
    address: "O/B St. James Settlement, Room 917, 9/F, Shatin Galleria, 18-24 Shan Mei St., Fo Tan, Shatin, Hong Kong",
    tel: "2116 1276"
  },
  'NP': {
    fullName: "PHARM+ St. James' Settlement Community Pharmacy",
    address: "9/F, 383 King's Road, North Point",
    tel: "2116 8836"
  }
};

const getStatusColor = (status, isCompleted) => {
  if (isCompleted) return 'bg-green-100 text-green-800 border-green-200';
  switch (status) {
    case 'Requested': return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'Accepted': return 'bg-purple-100 text-purple-800 border-purple-200';
    case 'Packed': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    case 'Dispatched': return 'bg-orange-100 text-orange-800 border-orange-200';
    case 'Received': return 'bg-indigo-100 text-indigo-800 border-indigo-200';
    default: return 'bg-gray-100 text-gray-800 border-gray-200';
  }
};

export default function App() {
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [ibts, setIbts] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState(null);
  const [pdfLibLoaded, setPdfLibLoaded] = useState(false);
  const [xlsxLibLoaded, setXlsxLibLoaded] = useState(false);

  // Dynamic script loader for production environments
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const loadScript = (src, onLoad) => {
      const script = document.createElement('script');
      script.src = src;
      script.async = true;
      script.onload = onLoad;
      document.body.appendChild(script);
    };

    loadScript("https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js", () => setPdfLibLoaded(true));
    loadScript("https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js", () => setXlsxLibLoaded(true));
  }, []);

  // Authentication Sequence (Rule 3)
  useEffect(() => {
    const initAuth = async () => {
      try {
        await signInAnonymously(auth);
      } catch (err) {
        console.error("Auth error:", err);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  const fetchInventory = async () => {
    try {
      const response = await fetch(SHEET_URL);
      const csvText = await response.text();
      const rows = csvText.split('\n').map(row => row.split(','));
      const headers = rows[0].map(h => h.trim().toLowerCase());
      const nameIdx = headers.findIndex(h => h.includes('name') || h.includes('drug'));
      const codeIdx = headers.findIndex(h => h.includes('code'));
      const priceIdx = headers.findIndex(h => h.includes('price'));

      const items = rows.slice(1).map((row, index) => ({
        name: row[nameIdx]?.trim() || 'Unknown',
        code: row[codeIdx]?.trim() || `SKU-${index}`,
        price: parseFloat(row[priceIdx]?.replace(/[^0-9.]/g, '') || '0'),
      })).filter(item => item.name !== 'Unknown');

      setInventory(items);
    } catch (err) {
      console.error("Fetch error:", err);
    }
  };

  useEffect(() => {
    fetchInventory();
  }, []);

  // Data Fetching (Rule 1: Path structure strictly followed)
  useEffect(() => {
    if (!user) return;
    const ibtsRef = collection(db, 'artifacts', APP_ID, 'public', 'data', 'ibts');
    const q = query(ibtsRef, orderBy('requestDate', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setIbts(data);
      setLoading(false);
    }, (err) => {
      console.error("Firestore Error:", err);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [user]);

  const showNotification = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const handleUpdateIBT = async (ibtId, updates) => {
    if (!user) return;
    try {
      const ibtRef = doc(db, 'artifacts', APP_ID, 'public', 'data', 'ibts', ibtId);
      await updateDoc(ibtRef, {
        ...updates,
        updatedAt: new Date().toISOString()
      });
      showNotification("Record updated successfully.");
    } catch (err) {
      showNotification("Update failed.", "error");
    }
  };

  const handleDeleteIBT = async (ibtId) => {
    if (!window.confirm("Are you sure you want to delete this IBT request?")) return;
    try {
      const ibtRef = doc(db, 'artifacts', APP_ID, 'public', 'data', 'ibts', ibtId);
      await deleteDoc(ibtRef);
      showNotification("IBT deleted successfully.");
    } catch (err) {
      showNotification("Delete failed.", "error");
    }
  };

  const generatePDF = (ibt) => {
    if (!pdfLibLoaded || !window.jspdf) {
      showNotification("PDF Library loading...", "error");
      return;
    }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    const fromBranch = BRANCH_INFO[ibt.requestByBranch] || { fullName: ibt.requestByBranch, address: '-', tel: '-' };
    const toBranch = BRANCH_INFO[ibt.targetBranch] || { fullName: ibt.targetBranch, address: '-', tel: '-' };
    const copies = ['Sender Copy', 'Receiver Copy', 'Admin Copy'];

    copies.forEach((copyLabel, index) => {
      if (index > 0) doc.addPage();
      let y = 15;
      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.text(COMPANY_NAME.toUpperCase(), 105, y, { align: "center" });
      y += 8;
      doc.setFontSize(14);
      doc.text("INTER-BRANCH TRANSFER (IBT) FORM", 105, y, { align: "center" });
      doc.setFontSize(10);
      doc.text(copyLabel, 190, y, { align: "right" });
      doc.setDrawColor(180, 180, 180);
      doc.line(20, y + 4, 190, y + 4);
      y += 15;
      doc.setFontSize(9);
      doc.text("SHIP TO (Destination Branch):", 20, y);
      doc.setFont("helvetica", "normal");
      doc.text(fromBranch.fullName, 20, y + 5);
      const fromAddr = doc.splitTextToSize(fromBranch.address, 75);
      doc.text(fromAddr, 20, y + 10);
      doc.text(`Tel: ${fromBranch.tel}`, 20, y + 10 + (fromAddr.length * 4));
      doc.setFont("helvetica", "bold");
      doc.text("FROM (Source Branch):", 110, y);
      doc.setFont("helvetica", "normal");
      doc.text(toBranch.fullName, 110, y + 5);
      const toAddr = doc.splitTextToSize(toBranch.address, 75);
      doc.text(toAddr, 110, y + 10);
      doc.text(`Tel: ${toBranch.tel}`, 110, y + 10 + (toAddr.length * 4));
      y += 35;
      doc.setFillColor(245, 245, 245);
      doc.rect(20, y, 170, 12, "F");
      doc.setFont("helvetica", "bold");
      doc.text(`IBT REF: ${ibt.refNumber}`, 25, y + 8);
      doc.text(`DATE: ${new Date(ibt.requestDate).toLocaleDateString()}`, 80, y + 8);
      doc.text(`REQUESTED BY: ${ibt.requestByStaff}`, 135, y + 8);
      y += 20;
      doc.text("Item Description / SKU", 20, y);
      doc.text("Batch", 80, y);
      doc.text("Expiry", 105, y);
      doc.text("Qty", 125, y);
      doc.text("Price", 145, y);
      doc.text("Total", 170, y);
      doc.setDrawColor(0, 0, 0);
      doc.line(20, y + 2, 190, y + 2);
      y += 8;
      let grandTotal = 0;
      doc.setFont("helvetica", "normal");
      ibt.items.forEach(item => {
        if (y > 240) { doc.addPage(); y = 20; }
        const itemTotal = (item.quantity || 0) * (item.price || 0);
        grandTotal += itemTotal;
        const itemName = `${item.name} (${item.code})`;
        const splitName = doc.splitTextToSize(itemName, 55);
        doc.text(splitName, 20, y);
        doc.text(item.batch || '-', 80, y);
        doc.text(item.expiry || '-', 105, y);
        doc.text(`${item.quantity} ${item.unit || ''}`, 125, y);
        doc.text(`$${(item.price || 0).toFixed(2)}`, 145, y);
        doc.text(`$${itemTotal.toFixed(2)}`, 170, y);
        y += Math.max(splitName.length * 5, 8);
      });
      y += 5;
      doc.line(140, y, 190, y);
      y += 7;
      doc.setFont("helvetica", "bold");
      doc.text("GRAND TOTAL:", 140, y);
      doc.text(`$${grandTotal.toFixed(2)}`, 170, y);
      y = 260;
      doc.setDrawColor(200, 200, 200);
      doc.line(20, y, 190, y);
      y += 10;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.text("Authorized Signature & Chop:", 20, y);
      doc.line(20, y + 15, 80, y + 15);
      doc.text("Receiver Signature:", 110, y);
      doc.line(110, y + 15, 170, y + 15);
    });
    doc.save(`IBT_${ibt.refNumber}_Triplicate.pdf`);
  };

  const exportToExcel = () => {
    if (!xlsxLibLoaded || !window.XLSX) {
      showNotification("Excel library loading...", "error");
      return;
    }
    try {
      const flattenedData = [];
      ibts.forEach(ibt => {
        const isComplete = ibt.senderPosAdjusted && ibt.receiverPosRecorded && ibt.adminRecorded;
        ibt.items.forEach(item => {
          flattenedData.push({
            'IBT Reference': ibt.refNumber,
            'Date': new Date(ibt.requestDate).toLocaleDateString(),
            'Status': ibt.status,
            'From': ibt.requestByBranch,
            'To': ibt.targetBranch,
            'Staff': ibt.requestByStaff,
            'Drug': item.name,
            'Code': item.code,
            'Batch': item.batch || '',
            'Expiry': item.expiry || '',
            'Qty': item.quantity,
            'Unit': item.unit || 'tablet',
            'Price': item.price || 0,
            'Admin Completed': isComplete ? 'YES' : 'NO'
          });
        });
      });
      const ws = window.XLSX.utils.json_to_sheet(flattenedData);
      const wb = window.XLSX.utils.book_new();
      window.XLSX.utils.book_append_sheet(wb, ws, "IBT Backup");
      window.XLSX.writeFile(wb, `Pharmacy_IBT_Export_${new Date().toISOString().split('T')[0]}.xlsx`);
      showNotification("Excel export success!");
    } catch (err) {
      showNotification("Excel export failed.", "error");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900">
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-30 px-4 py-3 sm:px-8 shadow-sm">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 p-2 rounded-lg shadow-indigo-100 shadow-lg"><ArrowLeftRight className="text-white h-5 w-5" /></div>
            <div>
              <h1 className="font-bold text-lg leading-tight text-slate-800">{COMPANY_NAME}</h1>
              <p className="text-xs text-slate-500 uppercase font-semibold tracking-widest">IBT Management System</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button onClick={fetchInventory} className="p-2 text-slate-400 hover:text-indigo-600 transition-all"><Loader2 className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} /></button>
            <div className="bg-slate-100 px-3 py-1.5 rounded-full border border-slate-200 text-xs font-medium text-slate-700 flex items-center gap-2">
              <User className="h-3 w-3" /> {user?.uid?.slice(0, 6) || 'Connecting...'}
            </div>
          </div>
        </div>
      </nav>

      <main className="flex-1 max-w-7xl mx-auto w-full p-4 sm:p-8">
        <div className="flex bg-white p-1 rounded-2xl shadow-md border border-slate-200 mb-8 overflow-hidden">
          <button onClick={() => setActiveTab('dashboard')} className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-bold transition-all ${activeTab === 'dashboard' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-600 hover:bg-slate-50'}`}><ClipboardList className="h-4 w-4" /> Consolidated List</button>
          <button onClick={() => setActiveTab('new')} className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-bold transition-all ${activeTab === 'new' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-600 hover:bg-slate-50'}`}><Plus className="h-4 w-4" /> New Request</button>
        </div>

        {activeTab === 'dashboard' ? (
          <Dashboard ibts={ibts} loading={loading} onUpdate={handleUpdateIBT} onDelete={handleDeleteIBT} onPrint={generatePDF} onExportExcel={exportToExcel} />
        ) : (
          <NewRequestForm inventory={inventory} onSubmitted={() => setActiveTab('dashboard')} showNotification={showNotification} />
        )}
      </main>

      {notification && (
        <div className={`fixed bottom-8 right-8 z-50 flex items-center gap-3 px-6 py-4 rounded-2xl shadow-2xl border animate-in slide-in-from-right-5 ${notification.type === 'success' ? 'bg-white border-green-100 text-green-800' : 'bg-white border-red-100 text-red-800'}`}>
          {notification.type === 'success' ? <CheckCircle className="h-5 w-5 text-green-500" /> : <AlertCircle className="h-5 w-5 text-red-500" />}
          <span className="font-bold">{notification.message}</span>
        </div>
      )}
    </div>
  );
}

function Dashboard({ ibts, loading, onUpdate, onDelete, onPrint, onExportExcel }) {
  const [filterBranch, setFilterBranch] = useState('All');
  const [filterStatus, setFilterStatus] = useState('All');
  const [hideCompleted, setHideCompleted] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIbtId, setSelectedIbtId] = useState(null);
  const [localItems, setLocalItems] = useState([]);

  const filteredIbts = useMemo(() => {
    return ibts.filter(ibt => {
      const isActuallyCompleted = ibt.senderPosAdjusted && ibt.receiverPosRecorded && ibt.adminRecorded;
      const matchBranch = filterBranch === 'All' || ibt.requestByBranch === filterBranch || ibt.targetBranch === filterBranch;
      const matchStatus = filterStatus === 'All' || (filterStatus === 'Completed' ? isActuallyCompleted : (ibt.status === filterStatus && !isActuallyCompleted));
      const matchHideCompleted = !hideCompleted || !isActuallyCompleted;
      const matchSearch = ibt.refNumber?.toLowerCase().includes(searchQuery.toLowerCase()) || ibt.requestByStaff?.toLowerCase().includes(searchQuery.toLowerCase());
      return matchBranch && matchStatus && matchHideCompleted && matchSearch;
    });
  }, [ibts, filterBranch, filterStatus, hideCompleted, searchQuery]);

  const skuMeta = useMemo(() => {
    const counts = {}; const totals = {}; const targets = {}; 
    localItems.forEach(item => {
      counts[item.code] = (counts[item.code] || 0) + 1;
      totals[item.code] = (totals[item.code] || 0) + (parseInt(item.quantity) || 0);
      targets[item.code] = item.originalQuantity || item.quantity;
    });
    return { counts, totals, targets };
  }, [localItems]);

  const startEditing = (ibt) => {
    setSelectedIbtId(selectedIbtId === ibt.id ? null : ibt.id);
    const itemsWithOrig = ibt.items.map(item => ({ ...item, originalQuantity: item.originalQuantity || item.quantity }));
    setLocalItems(itemsWithOrig);
  };

  const handleLocalItemChange = (idx, field, value) => {
    const next = [...localItems];
    next[idx] = { ...next[idx], [field]: value };
    setLocalItems(next);
  };

  const handleSplitItem = (idx) => {
    const next = [...localItems];
    const original = next[idx];
    const duplicate = { ...original, quantity: 0, batch: '', expiry: '' };
    next.splice(idx + 1, 0, duplicate);
    setLocalItems(next);
  };

  const handleRemoveItemEntry = (idx) => {
    if (localItems.length <= 1) return;
    const next = [...localItems];
    next.splice(idx, 1);
    setLocalItems(next);
  };

  if (loading) return <div className="text-center py-20 text-slate-400"><Loader2 className="h-10 w-10 animate-spin mx-auto mb-4" />Loading transfers...</div>;

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-4">
        <div className="flex flex-wrap gap-4 items-center justify-between">
          <div className="flex-1 min-w-[240px] relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input type="text" placeholder="Search Ref or Staff..." className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
          </div>
          <div className="flex flex-wrap gap-2">
            <select className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none font-bold" value={filterBranch} onChange={(e) => setFilterBranch(e.target.value)}><option value="All">All Branches</option>{BRANCHES.map(b => <option key={b} value={b}>{b}</option>)}</select>
            <select className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none font-bold" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}><option value="All">All Statuses</option>{LOGISTIC_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}<option value="Completed">Completed</option></select>
            <button onClick={() => setHideCompleted(!hideCompleted)} className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-bold border transition-all ${hideCompleted ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-slate-50 border-slate-200 text-slate-600'}`}>{hideCompleted ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}{hideCompleted ? 'Show Completed' : 'Hide Completed'}</button>
            <button onClick={onExportExcel} className="flex items-center gap-2 px-4 py-3 bg-green-600 text-white rounded-xl text-sm font-bold hover:bg-green-700 shadow-md"><FileSpreadsheet className="h-4 w-4" /> Export Excel</button>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {filteredIbts.length === 0 ? (
          <div className="text-center py-20 border-2 border-dashed border-slate-200 rounded-3xl text-slate-400"><ClipboardList className="h-10 w-10 mx-auto mb-3 opacity-20" />No transfers match current filters.</div>
        ) : (
          filteredIbts.map(ibt => {
            const isCompleted = ibt.senderPosAdjusted && ibt.receiverPosRecorded && ibt.adminRecorded;
            const isReceived = ibt.status === 'Received';
            return (
              <div key={ibt.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden transition-all group">
                <div className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] font-bold uppercase text-slate-400 tracking-tighter">REF#{ibt.refNumber}</span>
                      <div className="flex items-center gap-2">
                        <select className={`px-3 py-1 rounded-full text-xs font-bold border outline-none ${getStatusColor(ibt.status, isCompleted)}`} value={ibt.status} onChange={(e) => onUpdate(ibt.id, { status: e.target.value })}>{LOGISTIC_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}</select>
                        {isCompleted && <span className="flex items-center gap-1 text-[10px] font-black text-green-600 uppercase bg-green-50 px-2 py-1 rounded border border-green-200"><ShieldCheck className="h-3 w-3" /> Fully Completed</span>}
                      </div>
                    </div>
                    <h3 className="font-bold flex items-center gap-2"><span className="bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-lg text-xs font-bold">{ibt.requestByBranch}</span><ChevronRight className="h-4 w-4 text-slate-300" /><span className="bg-slate-50 text-slate-700 px-2.5 py-1 rounded-lg text-xs font-bold">{ibt.targetBranch}</span></h3>
                    <div className="flex items-center gap-4 text-xs text-slate-500"><span className="flex items-center gap-1.5"><User className="h-3.5 w-3.5 text-slate-400" /> {ibt.requestByStaff}</span><span className="flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5 text-slate-400" /> {new Date(ibt.requestDate).toLocaleDateString()}</span></div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => startEditing(ibt)} className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 rounded-xl text-sm font-bold transition-colors">{selectedIbtId === ibt.id ? 'Close' : 'Manage Record'}</button>
                    <button onClick={() => onPrint(ibt)} className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-100 transition-colors"><Download className="h-5 w-5" /></button>
                    <button onClick={() => onDelete(ibt.id)} className="p-2.5 text-slate-300 hover:text-red-500 transition-colors"><Trash2 className="h-5 w-5" /></button>
                  </div>
                </div>
                {selectedIbtId === ibt.id && (
                  <div className="border-t border-slate-100 bg-slate-50/40 p-4 lg:p-6 animate-in slide-in-from-top-2">
                    <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 lg:gap-6">
                       <div className="lg:col-span-1 bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3 h-fit">
                         <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2 mb-1"><FileText className="h-3 w-3" /> Admin Checks</h4>
                         <label className="flex items-center gap-2.5 p-2 bg-slate-50 rounded-lg border border-slate-100 cursor-pointer hover:bg-indigo-50 transition-colors"><input type="checkbox" className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" checked={ibt.senderPosAdjusted || false} onChange={(e) => onUpdate(ibt.id, { senderPosAdjusted: e.target.checked })} /><span className="text-[11px] font-bold text-slate-600">Sender POS Adjusted</span></label>
                         <label className={`flex items-center gap-2.5 p-2 rounded-lg border transition-colors ${isReceived ? 'bg-slate-50 border-slate-100 cursor-pointer hover:bg-indigo-50' : 'bg-slate-100/50 border-slate-200 cursor-not-allowed opacity-60'}`}><input type="checkbox" className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" checked={ibt.receiverPosRecorded || false} disabled={!isReceived} onChange={(e) => onUpdate(ibt.id, { receiverPosRecorded: e.target.checked })} /><div className="flex flex-col"><span className="text-[11px] font-bold text-slate-600">Receiver POS Recorded</span>{!isReceived && <span className="text-[8px] text-amber-600 font-medium">Wait for "Received" status</span>}</div></label>
                         <label className="flex items-center gap-2.5 p-2 bg-slate-50 rounded-lg border border-slate-100 cursor-pointer hover:bg-indigo-50 transition-colors"><input type="checkbox" className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" checked={ibt.adminRecorded || false} onChange={(e) => onUpdate(ibt.id, { adminRecorded: e.target.checked })} /><span className="text-[11px] font-bold text-slate-600">Admin Recorded</span></label>
                       </div>
                       <div className="lg:col-span-3 space-y-3">
                         <div className="flex justify-between items-center px-1"><h4 className="text-xs font-bold text-slate-700 flex items-center gap-2"><Layers className="h-4 w-4 text-indigo-500" /> Stock Batch Management</h4><button onClick={() => onUpdate(ibt.id, { items: localItems })} className="flex items-center gap-2 bg-indigo-600 text-white px-5 py-2 rounded-xl text-xs font-bold hover:bg-indigo-700 shadow-md transition-all active:scale-95"><Save className="h-3.5 w-3.5" /> Save Changes</button></div>
                         <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm"><div className="overflow-x-auto"><table className="w-full text-xs text-left"><thead className="bg-slate-50 text-slate-500 font-bold uppercase border-b"><tr><th className="px-4 py-3">Drug Description</th><th className="px-4 py-3 w-28 text-center">Qty</th><th className="px-4 py-3 w-24 text-center bg-slate-100/30">Target</th><th className="px-4 py-3 min-w-[150px]">Batch & Expiry</th><th className="px-4 py-3 w-24 text-center">Action</th></tr></thead><tbody className="divide-y divide-slate-50">{localItems.map((item, idx) => { const isSplit = skuMeta.counts[item.code] > 1; const currentSkuSum = skuMeta.totals[item.code]; const targetQty = skuMeta.targets[item.code]; const isSumMatched = currentSkuSum === targetQty; return (<tr key={idx} className={`hover:bg-slate-50/50 transition-colors ${isSplit ? 'bg-indigo-50/20 border-l-4 border-l-indigo-400' : ''}`}><td className="px-4 py-4"><div className="font-bold text-slate-800 leading-tight">{item.name}</div><div className="text-[9px] text-slate-400 mt-1 uppercase tracking-wider font-mono">{item.code}</div></td><td className="px-4 py-4 text-center"><div className="flex flex-col items-center gap-1"><input type="number" min="0" className="w-16 border-2 border-slate-200 rounded px-1.5 py-1 text-center font-bold text-indigo-600" value={item.quantity} onChange={(e) => handleLocalItemChange(idx, 'quantity', parseInt(e.target.value) || 0)} /><span className="text-[9px] font-bold text-slate-400 uppercase">{item.unit}</span></div></td><td className="px-4 py-4 text-center bg-slate-100/10"><div className="flex flex-col items-center gap-1"><span className="text-xs font-black text-slate-500">{targetQty}</span>{isSplit && (<div className={`px-1.5 py-0.5 rounded text-[8px] font-black whitespace-nowrap ${isSumMatched ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>SUM: {currentSkuSum}</div>)}</div></td><td className="px-4 py-4"><div className="grid grid-cols-2 gap-1.5"><input type="text" placeholder="Batch#" className="w-full border border-slate-200 rounded px-2 py-1.5 text-[11px]" value={item.batch || ''} onChange={(e) => handleLocalItemChange(idx, 'batch', e.target.value)} /><input type="text" placeholder="MM/YY" className="w-full border border-slate-200 rounded px-2 py-1.5 text-[11px]" value={item.expiry || ''} onChange={(e) => handleLocalItemChange(idx, 'expiry', e.target.value)} /></div></td><td className="px-4 py-4 text-center"><div className="flex justify-center gap-1.5"><button onClick={() => handleSplitItem(idx)} className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-600 hover:text-white transition-all shadow-sm"><Split className="h-4 w-4" /></button><button onClick={() => handleRemoveItemEntry(idx)} disabled={localItems.length <= 1} className="p-1.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-600 hover:text-white disabled:opacity-30"><Trash2 className="h-4 w-4" /></button></div></td></tr>); })}</tbody></table></div></div></div>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function NewRequestForm({ inventory, onSubmitted, showNotification }) {
  const [form, setForm] = useState({ requestByBranch: '', targetBranch: '', requestByStaff: '', items: [] });
  const [searchTerm, setSearchTerm] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const searchInputRef = useRef(null);

  const filteredItems = useMemo(() => {
    if (!searchTerm || searchTerm.length < 2) return [];
    const term = searchTerm.toLowerCase();
    return inventory.filter(i => i.name.toLowerCase().includes(term) || i.code.toLowerCase().includes(term)).slice(0, 10);
  }, [searchTerm, inventory]);

  const addItem = (item) => {
    if (form.items.some(i => i.code === item.code)) { showNotification(`${item.name} is already in list`, "error"); return; }
    setForm(prev => ({ ...prev, items: [...prev.items, { ...item, quantity: 1, originalQuantity: 1, unit: 'tablet', batch: '', expiry: '' }] }));
    setSearchTerm(''); setShowSearch(false);
    if (searchInputRef.current) setTimeout(() => searchInputRef.current.focus(), 10);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.requestByBranch || !form.targetBranch || !form.requestByStaff || form.items.length === 0) { showNotification("Complete all fields", "error"); return; }
    if (form.requestByBranch === form.targetBranch) { showNotification("Destination and Source cannot be same", "error"); return; }
    try {
      const now = new Date(); const dateStr = now.toISOString().split('T')[0].replace(/-/g, '').slice(2);
      const ref = `${form.requestByBranch}_to_${form.targetBranch}_${dateStr}`;
      await addDoc(collection(db, 'artifacts', APP_ID, 'public', 'data', 'ibts'), { ...form, refNumber: ref, requestDate: now.toISOString(), status: 'Requested', updatedAt: now.toISOString(), senderPosAdjusted: false, receiverPosRecorded: false, adminRecorded: false });
      showNotification("IBT Request submitted successfully!"); onSubmitted();
    } catch (err) { showNotification("Submission failed.", "error"); }
  };

  return (
    <div className="max-w-4xl mx-auto bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden">
      <div className="bg-indigo-600 p-8 text-white flex justify-between items-center"><div><h2 className="text-2xl font-bold">{COMPANY_NAME}</h2><p className="text-indigo-100 text-sm mt-1 uppercase tracking-widest font-semibold">New IBT Request</p></div><div className="bg-white/10 p-4 rounded-2xl"><Building2 className="h-8 w-8 text-white/80" /></div></div>
      <form onSubmit={handleSubmit} className="p-8 space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-2"><label className="text-xs font-bold text-slate-500 uppercase tracking-wider">From (Destination Branch)</label><select className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-4 py-3.5 text-sm outline-none focus:border-indigo-500 transition-all font-bold" value={form.requestByBranch} onChange={e => setForm(prev => ({...prev, requestByBranch: e.target.value}))} required><option value="">Select Branch</option>{BRANCHES.map(b => <option key={b} value={b}>{b}</option>)}</select></div>
          <div className="space-y-2"><label className="text-xs font-bold text-slate-500 uppercase tracking-wider">To (Source Branch)</label><select className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-4 py-3.5 text-sm outline-none focus:border-indigo-500 transition-all font-bold" value={form.targetBranch} onChange={e => setForm(prev => ({...prev, targetBranch: e.target.value}))} required><option value="">Select Branch</option>{BRANCHES.map(b => <option key={b} value={b}>{b}</option>)}</select></div>
          <div className="space-y-2"><label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Requested By (Staff)</label><input type="text" className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-4 py-3.5 text-sm outline-none focus:border-indigo-500 font-bold" placeholder="Your Full Name" value={form.requestByStaff} onChange={e => setForm(prev => ({...prev, requestByStaff: e.target.value}))} required /></div>
        </div>
        <div className="space-y-4 relative"><label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Search Inventory</label><div className="relative"><Search className="absolute left-5 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" /><input ref={searchInputRef} type="text" placeholder="Type drug name or code..." className="w-full pl-14 pr-4 py-5 bg-slate-50 border-2 border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-50/50 focus:border-indigo-500 text-lg font-medium transition-all" value={searchTerm} onFocus={() => setShowSearch(true)} onChange={(e) => setSearchTerm(e.target.value)} />{showSearch && filteredItems.length > 0 && (<div className="absolute top-full left-0 right-0 mt-3 bg-white rounded-2xl shadow-2xl border border-slate-200 z-50 overflow-hidden">{filteredItems.map((item, idx) => (<button key={idx} type="button" onClick={() => addItem(item)} className="w-full text-left px-6 py-4 hover:bg-slate-50 border-b last:border-0 flex justify-between items-center group transition-colors"><div><div className="font-bold text-slate-800 group-hover:text-indigo-600 transition-colors">{item.name}</div><div className="text-xs text-slate-400 font-mono">{item.code} — ${(item.price || 0).toFixed(2)}</div></div><Plus className="h-5 w-5 text-slate-300 group-hover:text-indigo-500" /></button>))}</div>)}</div></div>
        <div className="space-y-3">{form.items.length > 0 ? (<div className="border-2 border-slate-100 rounded-2xl overflow-hidden shadow-sm bg-white"><table className="w-full text-sm text-left"><thead className="bg-slate-50 text-[10px] font-bold uppercase text-slate-400 tracking-widest"><tr><th className="px-6 py-4">Item Details</th><th className="px-6 py-4 w-64 text-center">Qty & Unit</th><th className="px-6 py-4 w-20">Price</th><th className="px-6 py-4 w-12"></th></tr></thead><tbody className="divide-y divide-slate-100">{form.items.map(item => (<tr key={item.code} className="hover:bg-slate-50 transition-colors"><td className="px-6 py-5"><div className="font-bold text-slate-800 text-base">{item.name}</div><div className="text-xs text-slate-400 font-mono mt-1">{item.code}</div></td><td className="px-6 py-5 text-center"><div className="flex items-center justify-center gap-3"><input type="number" min="1" className="w-20 border-2 border-slate-200 rounded-xl px-3 py-3 text-center font-bold text-indigo-600 bg-slate-50 outline-none" value={item.quantity} onChange={e => setForm(prev => ({...prev, items: prev.items.map(i => i.code === item.code ? {...i, quantity: Math.max(1, parseInt(e.target.value) || 1), originalQuantity: Math.max(1, parseInt(e.target.value) || 1)} : i)}))} /><select className="border-2 border-slate-200 rounded-xl px-3 py-3 text-xs font-bold uppercase bg-slate-50 outline-none" value={item.unit} onChange={(e) => setForm(prev => ({...prev, items: prev.items.map(i => i.code === item.code ? {...i, unit: e.target.value} : i)}))}>{UNITS.map(u => <option key={u} value={u}>{u}</option>)}</select></div></td><td className="px-6 py-5 font-mono text-slate-500">${(item.price || 0).toFixed(2)}</td><td className="px-6 py-5 text-right"><button type="button" onClick={() => setForm(prev => ({ ...prev, items: prev.items.filter(i => i.code !== item.code) }))} className="p-2.5 text-slate-300 hover:text-red-500 transition-colors"><Trash2 className="h-5 w-5" /></button></td></tr>))}</tbody></table><div className="p-6 bg-slate-50 border-t flex justify-end"><div className="text-right"><p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Grand Total</p><p className="text-3xl font-black text-indigo-600">${form.items.reduce((sum, i) => sum + (i.quantity * i.price), 0).toFixed(2)}</p></div></div></div>) : (<div className="py-20 border-2 border-dashed border-slate-200 rounded-3xl text-center bg-slate-50/50 text-slate-400 font-medium">Add drugs to begin request.</div>)}</div>
        <button type="submit" disabled={form.items.length === 0} className={`w-full font-bold py-5 rounded-2xl shadow-xl transition-all flex items-center justify-center gap-3 active:scale-[0.98] ${form.items.length === 0 ? 'bg-slate-200 text-slate-400' : 'bg-indigo-600 hover:bg-indigo-700 text-white'}`}><Plus className="h-5 w-5" /> Submit IBT Transfer Request</button>
      </form>
    </div>
  );
}