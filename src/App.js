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
  CheckCircle, 
  FileText, 
  ChevronRight, 
  ArrowLeftRight, 
  User, 
  Building2, 
  Calendar, 
  Download, 
  Loader2, 
  Save, 
  Trash2, 
  Split, 
  Layers, 
  ShieldCheck, 
  FileSpreadsheet,
  Package
} from 'lucide-react';

// Hardcoded Firebase configuration for GitHub/Azure deployment
const firebaseConfig = {
  apiKey: "AIzaSyBOixLvmuEUCb-Tm-GlfszrrHWa8KjL5a0",
  authDomain: "sjsibt.firebaseapp.com",
  projectId: "sjsibt",
  storageBucket: "sjsibt.firebasestorage.app",
  messagingSenderId: "750662306150",
  appId: "1:750662306150:web:48c2b2d798f0f6431920a7",
  measurementId: "G-C7VKTZ5W5D"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Initialize Analytics safely for CI/CD without creating an unused variable
isSupported().then(yes => {
  if (yes) {
    getAnalytics(app);
  }
});

// Constants
const APP_ID = 'sjsibt';
const LOGISTIC_STATUSES = ['Requested', 'Accepted', 'Packed', 'Dispatched', 'Received'];
const BRANCHES = ['WC', 'NP', 'SSP', 'KT', 'ST'];
const UNITS = ['tablet', 'capsule', 'bottle', 'box', 'pcs'];
const SHEET_URL = "https://docs.google.com/spreadsheets/d/1lECgqYwshKlbAwRD3AA6dqjMo2XPqxOoI_NlenTy3ig/export?format=csv";
const COMPANY_NAME = "St. James' Settlement Community Pharmacy";

const BRANCH_INFO = {
  'WC': { fullName: "Philanthropic Community Pharmacy - WC", address: "O/B St. James Settlement, Room 8, 8/F, 85 Stone Nullah Lane, Wan Chai, Hong Kong", tel: "2831 3289" },
  'SSP': { fullName: "Philanthropic Community Pharmacy - SSP", address: "O/B St. James Settlement, Shop No. 7, G/F, High One Grand, 188 Fuk Wing Street, Sham Shui Po, Kowloon, HK", tel: "2389 9456" },
  'KT': { fullName: "Philanthropic Community Pharmacy - KT", address: "O/B St. James Settlement, Shop C1, 12/F, TG Place, Kwun Tong, Kowloon, Hong Kong", tel: "2116 4958" },
  'ST': { fullName: "Philanthropic Community Pharmacy - ST", address: "O/B St. James Settlement, Room 917, 9/F, Shatin Galleria, 18-24 Shan Mei St., Fo Tan, Shatin, Hong Kong", tel: "2116 1276" },
  'NP': { fullName: "PHARM+ St. James' Settlement Community Pharmacy", address: "9/F, 383 King's Road, North Point", tel: "2116 8836" }
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

  useEffect(() => {
    const loadScript = (src, callback) => {
      const script = document.createElement('script');
      script.src = src;
      script.async = true;
      script.onload = callback;
      document.body.appendChild(script);
    };

    loadScript("https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js", () => setPdfLibLoaded(true));
    loadScript("https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js", () => setXlsxLibLoaded(true));

    const unsubscribe = onAuthStateChanged(auth, (usr) => {
      if (!usr) {
        signInAnonymously(auth).catch(err => console.error("Auth Error:", err));
      }
      setUser(usr);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    fetch(SHEET_URL).then(res => res.text()).then(csv => {
      const rows = csv.split('\n').map(row => row.split(','));
      if (rows.length < 1) return;
      const headers = rows[0].map(h => h.trim().toLowerCase());
      const nameIdx = headers.findIndex(h => h.includes('name') || h.includes('drug'));
      const codeIdx = headers.findIndex(h => h.includes('code'));
      const priceIdx = headers.findIndex(h => h.includes('price'));
      setInventory(rows.slice(1).map((row, i) => ({
        name: row[nameIdx]?.trim() || 'Unknown',
        code: row[codeIdx]?.trim() || `SKU-${i}`,
        price: parseFloat(row[priceIdx]?.replace(/[^0-9.]/g, '') || '0'),
      })).filter(item => item.name !== 'Unknown'));
    }).catch(err => console.error("Inventory Load Error:", err));
  }, []);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    const ibtsRef = collection(db, 'artifacts', APP_ID, 'public', 'data', 'ibts');
    const q = query(ibtsRef, orderBy('requestDate', 'desc'));

    const unsubscribe = onSnapshot(q, (snap) => {
      setIbts(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
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

  const handleUpdateIBT = async (id, updates) => {
    try {
      await updateDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'ibts', id), { ...updates, updatedAt: new Date().toISOString() });
      showNotification("Record updated.");
    } catch (err) { showNotification("Update failed.", "error"); }
  };

  const handleDeleteIBT = async (id) => {
    if (!window.confirm("Delete this IBT permanently?")) return;
    try {
      await deleteDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'ibts', id));
      showNotification("Record deleted.");
    } catch (err) { showNotification("Delete error.", "error"); }
  };

  const generatePDF = (ibt) => {
    if (!pdfLibLoaded || !window.jspdf) return showNotification("Library loading...", "error");
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const dest = BRANCH_INFO[ibt.requestByBranch] || { fullName: ibt.requestByBranch, address: '-', tel: '-' };
    const src = BRANCH_INFO[ibt.targetBranch] || { fullName: ibt.targetBranch, address: '-', tel: '-' };
    const copies = ['Sender Copy', 'Receiver Copy', 'Admin Copy'];

    copies.forEach((label, i) => {
      if (i > 0) doc.addPage();
      let y = 15;
      doc.setFontSize(16); doc.setFont("helvetica", "bold");
      doc.text(COMPANY_NAME.toUpperCase(), 105, y, { align: "center" });
      y += 8;
      doc.setFontSize(12);
      doc.text("INTER-BRANCH TRANSFER (IBT) FORM", 105, y, { align: "center" });
      doc.setFontSize(10);
      doc.text(label, 190, y, { align: "right" });
      doc.setDrawColor(200); doc.line(20, y + 4, 190, y + 4);

      y += 15;
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold"); doc.text("DESTINATION:", 20, y); 
      doc.setFont("helvetica", "normal"); doc.text(dest.fullName, 20, y + 5); 
      doc.text(dest.address, 20, y + 10, { maxWidth: 75 });

      doc.setFont("helvetica", "bold"); doc.text("SOURCE:", 110, y); 
      doc.setFont("helvetica", "normal"); doc.text(src.fullName, 110, y + 5); 
      doc.text(src.address, 110, y + 10, { maxWidth: 75 });

      y += 30;
      doc.setFillColor(245); doc.rect(20, y, 170, 10, "F");
      doc.setFont("helvetica", "bold");
      doc.text(`REF: ${ibt.refNumber}  |  DATE: ${new Date(ibt.requestDate).toLocaleDateString()}`, 25, y + 6);

      y += 15;
      doc.text("Item Name", 20, y); doc.text("Qty", 115, y); doc.text("Batch", 135, y); doc.text("Expiry", 160, y); doc.text("Total", 180, y);
      doc.line(20, y + 2, 190, y + 2); y += 8; doc.setFont("helvetica", "normal");

      let grandTotal = 0;
      ibt.items.forEach(item => {
        const itemTotal = (item.quantity || 0) * (item.price || 0);
        grandTotal += itemTotal;
        doc.text(item.name, 20, y, { maxWidth: 90 });
        doc.text(`${item.quantity} ${item.unit}`, 115, y);
        doc.text(item.batch || '-', 135, y);
        doc.text(item.expiry || '-', 160, y);
        doc.text(`$${itemTotal.toFixed(1)}`, 180, y);
        y += 8;
        if (y > 250) { doc.addPage(); y = 20; }
      });

      y += 5; doc.setFont("helvetica", "bold");
      doc.text(`GRAND TOTAL: $${grandTotal.toFixed(2)}`, 190, y, { align: "right" });

      y = 265;
      doc.line(20, y, 190, y);
      doc.setFontSize(8);
      doc.text("Authorized Signature & Chop:", 20, y + 5);
      doc.text("Receiver Signature:", 110, y + 5);
    });
    doc.save(`IBT_${ibt.refNumber}.pdf`);
  };

  const handleExportExcel = () => {
    if (!xlsxLibLoaded || !window.XLSX) return showNotification("Excel engine starting...", "error");
    const data = [];
    ibts.forEach(ibt => {
      const isDone = ibt.senderPosAdjusted && ibt.receiverPosRecorded && ibt.adminRecorded;
      ibt.items.forEach(item => {
        data.push({
          Ref: ibt.refNumber,
          Date: new Date(ibt.requestDate).toLocaleDateString(),
          From: ibt.requestByBranch,
          To: ibt.targetBranch,
          Staff: ibt.requestByStaff,
          Drug: item.name,
          Qty: item.quantity,
          Unit: item.unit,
          Batch: item.batch,
          Expiry: item.expiry,
          Status: ibt.status,
          Completed: isDone ? 'Yes' : 'No'
        });
      });
    });
    const ws = window.XLSX.utils.json_to_sheet(data);
    const wb = window.XLSX.utils.book_new();
    window.XLSX.utils.book_append_sheet(wb, ws, "IBT Export");
    window.XLSX.writeFile(wb, `IBT_Backup_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <div className="min-h-screen flex flex-col font-sans text-slate-900 bg-slate-50">
      <nav className="bg-white border-b sticky top-0 z-30 px-4 py-3 sm:px-8 shadow-sm">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 p-2 rounded-lg shadow-lg">
              <ArrowLeftRight className="text-white h-5 w-5" />
            </div>
            <div>
              <h1 className="font-bold text-lg leading-tight text-slate-800">{COMPANY_NAME}</h1>
              <p className="text-xs text-slate-500 uppercase font-semibold tracking-widest">IBT Management System</p>
            </div>
          </div>
          <div className="text-xs font-medium text-slate-400">User: {user?.uid?.slice(0, 6) || 'Connecting...'}</div>
        </div>
      </nav>

      <main className="flex-1 max-w-7xl mx-auto w-full p-4 sm:p-8">
        <div className="flex bg-white p-1 rounded-2xl shadow-md border mb-8 border-slate-200">
          <button onClick={() => setActiveTab('dashboard')} className={`flex-1 py-3 px-4 rounded-xl text-sm font-bold transition-all ${activeTab === 'dashboard' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-600 hover:bg-slate-50'}`}>Consolidated List</button>
          <button onClick={() => setActiveTab('new')} className={`flex-1 py-3 px-4 rounded-xl text-sm font-bold transition-all ${activeTab === 'new' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-600 hover:bg-slate-50'}`}>New Request</button>
        </div>

        {activeTab === 'dashboard' ? (
          <Dashboard ibts={ibts} loading={loading} onUpdate={handleUpdateIBT} onDelete={handleDeleteIBT} onPrint={generatePDF} onExport={handleExportExcel} />
        ) : (
          <NewRequestForm inventory={inventory} onSubmitted={() => setActiveTab('dashboard')} showNotification={showNotification} />
        )}
      </main>

      {notification && (
        <div className={`fixed bottom-8 right-8 z-50 flex items-center gap-3 px-6 py-4 rounded-2xl shadow-2xl border animate-in slide-in-from-right-5 ${notification.type === 'success' ? 'bg-white border-green-100 text-green-800' : 'bg-white border-red-100 text-red-800'}`}>
          <CheckCircle className="h-5 w-5" /> {notification.message}
        </div>
      )}
    </div>
  );
}

function Dashboard({ ibts, loading, onUpdate, onDelete, onPrint, onExport }) {
  const [filter, setFilter] = useState({ branch: 'All', status: 'All', query: '', hideCompleted: false });
  const [editingId, setEditingId] = useState(null);
  const [localItems, setLocalItems] = useState([]);

  const filtered = useMemo(() => ibts.filter(i => {
    const isActuallyDone = i.senderPosAdjusted && i.receiverPosRecorded && i.adminRecorded;
    const matchSearch = i.refNumber.toLowerCase().includes(filter.query.toLowerCase()) || 
                       i.requestByStaff?.toLowerCase().includes(filter.query.toLowerCase());
    return (filter.branch === 'All' || i.requestByBranch === filter.branch || i.targetBranch === filter.branch) &&
           (filter.status === 'All' || (filter.status === 'Completed' ? isActuallyDone : i.status === filter.status)) &&
           (!filter.hideCompleted || !isActuallyDone) &&
           matchSearch;
  }), [ibts, filter]);

  const skuMeta = useMemo(() => {
    const counts = {}; const totals = {}; const targets = {};
    localItems.forEach(item => {
      counts[item.code] = (counts[item.code] || 0) + 1;
      totals[item.code] = (totals[item.code] || 0) + (parseInt(item.quantity) || 0);
      targets[item.code] = item.originalQuantity || item.quantity;
    });
    return { counts, totals, targets };
  }, [localItems]);

  if (loading) return <div className="text-center py-20 text-slate-400"><Loader2 className="h-10 w-10 animate-spin mx-auto mb-4 text-indigo-600" />Loading records...</div>;

  return (
    <div className="space-y-6">
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex flex-wrap gap-4 items-center">
        <div className="flex-1 relative min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input type="text" placeholder="Search Ref or Staff..." className="w-full pl-10 pr-4 py-2 bg-slate-50 border rounded-xl text-sm outline-none" value={filter.query} onChange={e => setFilter({...filter, query: e.target.value})} />
        </div>
        <div className="flex flex-wrap gap-2">
          <select className="bg-slate-50 border rounded-xl px-3 py-2 text-sm outline-none font-bold" value={filter.branch} onChange={e => setFilter({...filter, branch: e.target.value})}><option value="All">Branches</option>{BRANCHES.map(b => <option key={b} value={b}>{b}</option>)}</select>
          <select className="bg-slate-50 border rounded-xl px-3 py-2 text-sm outline-none font-bold" value={filter.status} onChange={e => setFilter({...filter, status: e.target.value})}><option value="All">Status</option>{LOGISTIC_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}<option value="Completed">Completed</option></select>
          <button onClick={() => setFilter({...filter, hideCompleted: !filter.hideCompleted})} className={`px-4 py-2 rounded-xl text-sm font-bold border transition-all ${filter.hideCompleted ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-slate-50'}`}>{filter.hideCompleted ? 'Show All' : 'Hide Completed'}</button>
          <button onClick={onExport} className="px-4 py-2 bg-green-600 text-white rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-green-700 shadow-md"><FileSpreadsheet className="h-4 w-4" /> Export</button>
        </div>
      </div>

      <div className="space-y-4">
        {filtered.map(ibt => {
          const isDone = ibt.senderPosAdjusted && ibt.receiverPosRecorded && ibt.adminRecorded;
          const isReceived = ibt.status === 'Received';
          return (
            <div key={ibt.id} className="bg-white rounded-2xl border shadow-sm border-slate-200 overflow-hidden group">
              <div className="p-5 flex flex-col md:flex-row justify-between gap-4">
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">REF#{ibt.refNumber}</span>
                    <select className={`px-3 py-1 rounded-full text-xs font-bold border outline-none ${getStatusColor(ibt.status, isDone)}`} value={ibt.status} onChange={e => onUpdate(ibt.id, { status: e.target.value })}>{LOGISTIC_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}</select>
                    {isDone && <span className="text-[10px] font-black text-green-600 uppercase bg-green-50 px-2 py-1 rounded border border-green-200 flex items-center gap-1 shadow-sm"><ShieldCheck className="h-3 w-3" /> Done</span>}
                  </div>
                  <h3 className="font-bold text-slate-800 flex items-center gap-2">
                    <span className="bg-indigo-50 text-indigo-700 px-2.5 py-0.5 rounded text-sm">{ibt.requestByBranch}</span>
                    <ChevronRight className="h-4 w-4 text-slate-300" />
                    <span className="bg-slate-50 text-slate-700 px-2.5 py-0.5 rounded text-sm">{ibt.targetBranch}</span>
                  </h3>
                  <div className="flex items-center gap-4 text-xs text-slate-500">
                    <span className="flex items-center gap-1.5"><User className="h-3.5 w-3.5 text-slate-400" /> {ibt.requestByStaff}</span>
                    <span className="flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5 text-slate-400" /> {new Date(ibt.requestDate).toLocaleDateString()}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => { setEditingId(editingId === ibt.id ? null : ibt.id); setLocalItems(ibt.items); }} className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 rounded-xl text-sm font-bold text-slate-700 transition-all">Manage</button>
                  <button onClick={() => onPrint(ibt)} className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-100 transition-all"><Download className="h-5 w-5" /></button>
                  <button onClick={() => onDelete(ibt.id)} className="p-2.5 text-slate-300 hover:text-red-500 transition-all"><Trash2 className="h-5 w-5" /></button>
                </div>
              </div>
              {editingId === ibt.id && (
                <div className="border-t border-slate-100 bg-slate-50/40 p-4 lg:p-6 animate-in slide-in-from-top-2">
                  <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                    <div className="lg:col-span-1 bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3 h-fit">
                      <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5"><FileText className="h-3 w-3" /> Admin Record</h4>
                      <label className="flex items-center gap-2 text-[11px] font-bold text-slate-600 p-2 bg-slate-50 rounded-lg border border-slate-100 cursor-pointer hover:bg-indigo-50 transition-colors"><input type="checkbox" className="rounded" checked={ibt.senderPosAdjusted || false} onChange={e => onUpdate(ibt.id, { senderPosAdjusted: e.target.checked })} /> Sender POS Adjusted</label>
                      <label className={`flex items-center gap-2 text-[11px] font-bold text-slate-600 p-2 rounded-lg border transition-all ${isReceived ? 'bg-slate-50 border-slate-100 cursor-pointer hover:bg-indigo-50' : 'bg-slate-100/50 border-slate-200 opacity-50 cursor-not-allowed'}`}><input type="checkbox" disabled={!isReceived} checked={ibt.receiverPosRecorded || false} onChange={e => onUpdate(ibt.id, { receiverPosRecorded: e.target.checked })} /> Receiver POS Recorded</label>
                      <label className="flex items-center gap-2 text-[11px] font-bold text-slate-600 p-2 bg-slate-50 rounded-lg border border-slate-100 cursor-pointer hover:bg-indigo-50 transition-colors"><input type="checkbox" className="rounded" checked={ibt.adminRecorded || false} onChange={e => onUpdate(ibt.id, { adminRecorded: e.target.checked })} /> Admin Recorded</label>
                    </div>
                    <div className="lg:col-span-3 space-y-3">
                      <div className="flex justify-between items-center px-1">
                        <h4 className="text-xs font-bold text-slate-700 flex items-center gap-2"><Layers className="h-4 w-4 text-indigo-500" /> Stock Processing</h4>
                        <button onClick={() => onUpdate(ibt.id, { items: localItems })} className="bg-indigo-600 text-white px-5 py-2 rounded-xl text-xs font-bold hover:bg-indigo-700 flex items-center gap-2 shadow-lg active:scale-95 transition-all"><Save className="h-3.5 w-3.5" /> Save Records</button>
                      </div>
                      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs text-left">
                            <thead className="bg-slate-50 uppercase font-bold border-b border-slate-200"><tr><th className="px-4 py-3">Drug</th><th className="px-4 py-3 w-28 text-center">Qty</th><th className="px-4 py-3 w-24 text-center bg-slate-100/30">Target</th><th className="px-4 py-3 min-w-[150px]">Batch / Expiry</th><th className="px-4 py-3 w-16 text-center">Action</th></tr></thead>
                            <tbody className="divide-y divide-slate-100">
                              {localItems.map((item, idx) => {
                                const isSplit = skuMeta.counts[item.code] > 1;
                                const sum = skuMeta.totals[item.code];
                                const target = skuMeta.targets[item.code];
                                return (
                                  <tr key={idx} className={`hover:bg-slate-50/50 transition-colors ${isSplit ? 'bg-indigo-50/20 border-l-4 border-l-indigo-400' : ''}`}>
                                    <td className="px-4 py-4 font-bold text-slate-800 leading-tight">{item.name}<div className="text-[9px] text-slate-400 mt-1 uppercase tracking-wider">{item.code}</div></td>
                                    <td className="px-4 py-4 text-center">
                                      <input type="number" className="w-16 border border-slate-200 rounded px-1.5 py-1 text-center font-bold text-indigo-600 outline-none focus:border-indigo-500" value={item.quantity} onChange={e => { const next = [...localItems]; next[idx].quantity = parseInt(e.target.value) || 0; setLocalItems(next); }} />
                                      <div className="text-[9px] text-slate-400 uppercase font-bold mt-1">{item.unit}</div>
                                    </td>
                                    <td className="px-4 py-4 text-center bg-slate-100/10 border-x border-slate-100">
                                      <div className="text-sm font-black text-slate-500">{target}</div>
                                      {isSplit && <div className={`text-[8px] font-black p-0.5 rounded mt-1 shadow-sm whitespace-nowrap ${sum === target ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>SUM: {sum}</div>}
                                    </td>
                                    <td className="px-4 py-4">
                                      <div className="grid grid-cols-2 gap-1.5">
                                        <input type="text" placeholder="Batch#" className="border border-slate-200 rounded px-2 py-1.5 text-[11px] outline-none bg-white focus:border-indigo-500" value={item.batch} onChange={e => { const next = [...localItems]; next[idx].batch = e.target.value; setLocalItems(next); }} />
                                        <input type="text" placeholder="MM/YY" className="border border-slate-200 rounded px-2 py-1.5 text-[11px] outline-none bg-white focus:border-indigo-500" value={item.expiry} onChange={e => { const next = [...localItems]; next[idx].expiry = e.target.value; setLocalItems(next); }} />
                                      </div>
                                    </td>
                                    <td className="px-4 py-4 text-center">
                                      <div className="flex gap-1 justify-center">
                                        <button onClick={() => { const next = [...localItems]; next.splice(idx + 1, 0, {...item, quantity: 0, batch: '', expiry: ''}); setLocalItems(next); }} className="p-1 bg-indigo-50 text-indigo-600 rounded hover:bg-indigo-600 hover:text-white transition-all shadow-sm"><Split className="h-3.5 w-3.5" /></button>
                                        <button onClick={() => { if (localItems.length > 1) { const next = [...localItems]; next.splice(idx, 1); setLocalItems(next); } }} className="p-1 text-slate-300 hover:text-red-500 transition-all"><Trash2 className="h-3.5 w-3.5" /></button>
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function NewRequestForm({ inventory, onSubmitted, showNotification }) {
  const [form, setForm] = useState({ requestByBranch: '', targetBranch: '', requestByStaff: '', items: [] });
  const [search, setSearch] = useState('');
  const [showRes, setShowRes] = useState(false);
  const inputRef = useRef(null);

  const filtered = useMemo(() => {
    if (search.length < 2) return [];
    return inventory.filter(i => 
      i.name.toLowerCase().includes(search.toLowerCase()) || i.code.toLowerCase().includes(search.toLowerCase())
    ).slice(0, 10);
  }, [search, inventory]);

  const submit = async (e) => {
    e.preventDefault();
    if (!form.requestByBranch || !form.targetBranch || !form.requestByStaff || !form.items.length) {
      showNotification("Please fill all fields.", "error");
      return;
    }
    if (form.requestByBranch === form.targetBranch) {
      showNotification("Destination and Source cannot be the same.", "error");
      return;
    }
    try {
      const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, '').slice(2);
      const ref = `${form.requestByBranch}_to_${form.targetBranch}_${dateStr}`;
      await addDoc(collection(db, 'artifacts', APP_ID, 'public', 'data', 'ibts'), {
        ...form,
        refNumber: ref,
        requestDate: new Date().toISOString(),
        status: 'Requested',
        updatedAt: new Date().toISOString(),
        senderPosAdjusted: false,
        receiverPosRecorded: false,
        adminRecorded: false
      });
      showNotification("IBT Request Sent!"); onSubmitted();
    } catch (err) {
      console.error(err);
      showNotification("Submission Error.", "error");
    }
  };

  return (
    <div className="max-w-4xl mx-auto bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden">
      <div className="bg-indigo-600 p-8 text-white flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">{COMPANY_NAME}</h2>
          <p className="text-indigo-100 text-sm font-semibold uppercase tracking-widest mt-1">New Transfer Request</p>
        </div>
        <Building2 className="h-10 w-10 opacity-30" />
      </div>
      <form onSubmit={submit} className="p-8 space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Destination (From)</label>
            <select className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-indigo-500 transition-all" value={form.requestByBranch} onChange={e => setForm({...form, requestByBranch: e.target.value})} required>
              <option value="">Select Branch</option>
              {BRANCHES.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Source (To)</label>
            <select className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-indigo-500 transition-all" value={form.targetBranch} onChange={e => setForm({...form, targetBranch: e.target.value})} required>
              <option value="">Select Branch</option>
              {BRANCHES.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Staff Name</label>
            <input type="text" className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-indigo-500" placeholder="Full Name" value={form.requestByStaff} onChange={e => setForm({...form, requestByStaff: e.target.value})} required />
          </div>
        </div>

        <div className="space-y-4 relative">
          <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Search Inventory</label>
          <div className="relative">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
            <input ref={inputRef} type="text" placeholder="Type drug name or code..." className="w-full pl-14 pr-4 py-5 bg-slate-50 border-2 border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-50/50 focus:border-indigo-500 text-lg font-medium transition-all" value={search} onFocus={() => setShowRes(true)} onChange={e => setSearch(e.target.value)} />
            {showRes && filtered.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-3 bg-white rounded-2xl shadow-2xl border border-slate-200 z-50 overflow-hidden">
                {filtered.map((item, i) => (
                  <button key={i} type="button" onClick={() => {
                    if (!form.items.some(x => x.code === item.code)) {
                      setForm({...form, items: [...form.items, {...item, quantity: 1, originalQuantity: 1, unit: 'tablet', batch: '', expiry: ''}]});
                    }
                    setSearch(''); setShowRes(false); inputRef.current?.focus();
                  }} className="w-full text-left px-6 py-4 hover:bg-slate-50 border-b last:border-0 flex justify-between items-center group transition-colors">
                    <div>
                      <div className="font-bold text-slate-800 group-hover:text-indigo-600 transition-colors">{item.name}</div>
                      <div className="text-xs text-slate-400 font-mono tracking-tighter uppercase">{item.code} — $ {item.price.toFixed(1)}</div>
                    </div>
                    <Plus className="h-5 w-5 text-slate-300 group-hover:text-indigo-500" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-3">
          {form.items.length > 0 ? (
            <div className="border-2 rounded-2xl overflow-hidden shadow-sm bg-white border-slate-100">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-200">
                  <tr><th className="px-6 py-4">Item Details</th><th className="px-6 py-4 w-64 text-center">Qty & Unit</th><th className="px-6 py-4 w-12"></th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {form.items.map(i => (
                    <tr key={i.code} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-5">
                        <div className="font-bold text-slate-800 leading-tight">{i.name}</div>
                        <div className="text-[10px] text-slate-400 font-mono uppercase tracking-widest mt-1">{i.code}</div>
                      </td>
                      <td className="px-6 py-5 text-center">
                        <div className="flex justify-center gap-3">
                          <input type="number" min="1" className="w-20 border-2 border-slate-200 rounded-xl px-3 py-3 text-center font-bold text-indigo-600 bg-slate-50 outline-none" value={i.quantity} onChange={e => {
                            const val = parseInt(e.target.value) || 1;
                            setForm({...form, items: form.items.map(x => x.code === i.code ? {...x, quantity: val, originalQuantity: val} : x)});
                          }} />
                          <select className="border-2 border-slate-200 rounded-xl px-3 py-3 text-xs font-bold uppercase bg-slate-50 outline-none" value={i.unit} onChange={e => setForm({...form, items: form.items.map(x => x.code === i.code ? {...x, unit: e.target.value} : x)})}>
                            {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                          </select>
                        </div>
                      </td>
                      <td className="px-6 py-5 text-right">
                        <button type="button" onClick={() => setForm({...form, items: form.items.filter(x => x.code !== i.code)})} className="p-2.5 text-slate-300 hover:text-red-500 transition-all rounded-full hover:bg-red-50">
                          <Trash2 className="h-5 w-5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="p-6 bg-slate-50 border-t border-slate-200 flex justify-end">
                <div className="text-right">
                  <p className="text-xs text-slate-400 font-bold uppercase mb-1 tracking-tighter">Total Estimated Value</p>
                  <p className="text-3xl font-black text-indigo-600">${form.items.reduce((s, x) => s + (x.quantity * x.price), 0).toFixed(2)}</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="py-20 border-2 border-dashed border-slate-200 rounded-3xl text-center bg-slate-50/50 text-slate-400 font-medium border-slate-200">
              <Package className="h-10 w-10 mx-auto mb-3 opacity-20" />
              Search and add drugs to begin this request.
            </div>
          )}
        </div>
        <button type="submit" disabled={!form.items.length} className={`w-full font-bold py-5 rounded-2xl shadow-xl transition-all flex items-center justify-center gap-3 active:scale-[0.98] ${!form.items.length ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none' : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-100'}`}>
          <Plus className="h-5 w-5" /> Submit IBT Transfer Request
        </button>
      </form>
    </div>
  );
}
