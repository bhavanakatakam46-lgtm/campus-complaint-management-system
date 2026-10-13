import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Activity, AlertTriangle, ArrowDownRight, ArrowUpRight, Check, ClipboardList,
  Clock3, FileText, LayoutDashboard, LogOut, Search, ShieldCheck, Users, X,
} from "lucide-react";
import {
  Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from "recharts";
import {
  collection, doc, getDoc, onSnapshot, serverTimestamp, updateDoc,
} from "firebase/firestore";
import { db } from "../firebase.js";
import { useAuth } from "../auth/useAuth.js";
import {
  getPrototypeComplaints,
  savePrototypeComplaints,
  subscribeToPrototypeComplaints,
} from "../data/prototypeData.js";
import "./AdminDashboard.css";

const chartColors = ["#3975ba", "#34a58c", "#e1a247", "#d86e70", "#8977c2", "#5ba6b8"];
const statusOptions = ["Pending", "In Progress", "Resolved"];
const priorityOptions = ["Low", "Medium", "High"];

function asDate(value) {
  if (value?.toDate) return value.toDate();
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDate(value) {
  const date = asDate(value);
  return date ? new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(date) : "Date unavailable";
}

function normalizeStatus(value) {
  const status = (value || "Pending").toLowerCase().replaceAll("_", " ").trim();
  if (status === "resolved" || status === "closed") return "Resolved";
  if (status === "in progress" || status === "in-progress") return "In Progress";
  return "Pending";
}

export default function AdminDashboardPage({ view = "overview" }) {
  const { user, logOut } = useAuth();
  const [access, setAccess] = useState(user?.isDemo ? "allowed" : db ? "checking" : "unavailable");
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(Boolean(db && user));
  const [loadError, setLoadError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("All statuses");
  const [selectedComplaint, setSelectedComplaint] = useState(null);
  const [editStatus, setEditStatus] = useState("Pending");
  const [editPriority, setEditPriority] = useState("Medium");
  const [resolutionNotes, setResolutionNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saveSuccess, setSaveSuccess] = useState("");
  const [verifiedUid, setVerifiedUid] = useState("");
  const visibleAccess = user?.isDemo ? "allowed" : verifiedUid === user?.uid
    ? access
    : db ? "checking" : "unavailable";

  useEffect(() => {
    if (user?.isDemo) {
      const refreshPrototypeComplaints = () => {
        try {
          setComplaints(getPrototypeComplaints().sort(
            (first, second) => (asDate(second.createdAt)?.getTime() ?? 0) - (asDate(first.createdAt)?.getTime() ?? 0),
          ));
          setLoadError("");
        } catch (error) {
          setLoadError(error.message || "Could not load prototype complaints.");
        } finally {
          setLoading(false);
        }
      };
      queueMicrotask(refreshPrototypeComplaints);
      return subscribeToPrototypeComplaints(refreshPrototypeComplaints);
    }
    if (!db || !user) {
      return undefined;
    }

    let active = true;
    let unsubscribe = () => {};

    async function authorizeAndListen() {
      try {
        const membership = await getDoc(doc(db, "admins", user.uid));
        if (!active) return;
        if (!membership.exists()) {
          setVerifiedUid(user.uid);
          setAccess("denied");
          setLoading(false);
          return;
        }

        setVerifiedUid(user.uid);
        setAccess("allowed");
        unsubscribe = onSnapshot(collection(db, "complaints"), (snapshot) => {
          const items = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
          items.sort((first, second) => (asDate(second.createdAt)?.getTime() ?? 0) - (asDate(first.createdAt)?.getTime() ?? 0));
          setComplaints(items);
          setLoadError("");
          setLoading(false);
        }, (error) => {
          setLoadError(error.message || "Could not load complaints.");
          setLoading(false);
        });
      } catch (error) {
        if (!active) return;
        setVerifiedUid(user.uid);
        setAccess("denied");
        setLoadError(error.message || "Administrator access could not be verified.");
        setLoading(false);
      }
    }

    authorizeAndListen();
    return () => {
      active = false;
      unsubscribe();
    };
  }, [user]);

  const totals = useMemo(() => ({
    all: complaints.length,
    pending: complaints.filter((item) => normalizeStatus(item.status) === "Pending").length,
    inProgress: complaints.filter((item) => normalizeStatus(item.status) === "In Progress").length,
    resolved: complaints.filter((item) => normalizeStatus(item.status) === "Resolved").length,
    highPriority: complaints.filter((item) => (item.priority || "Medium").toLowerCase() === "high").length,
  }), [complaints]);

  const categoryData = useMemo(() => {
    const counts = complaints.reduce((result, item) => {
      const category = item.category || "Other";
      result[category] = (result[category] || 0) + 1;
      return result;
    }, {});
    return Object.entries(counts).map(([name, value], index) => ({ name, value, color: chartColors[index % chartColors.length] }));
  }, [complaints]);

  const statusData = [
    { name: "Pending", count: totals.pending, color: "#e1a247" },
    { name: "In progress", count: totals.inProgress, color: "#3975ba" },
    { name: "Resolved", count: totals.resolved, color: "#34a58c" },
  ];

  const visibleComplaints = complaints.filter((item) => {
    const matchesStatus = statusFilter === "All statuses" || normalizeStatus(item.status) === statusFilter;
    const search = `${item.id} ${item.title || ""} ${item.category || ""} ${item.studentId || ""}`.toLowerCase();
    return matchesStatus && search.includes(searchTerm.toLowerCase());
  });

  function openComplaint(item) {
    setSelectedComplaint(item);
    setEditStatus(normalizeStatus(item.status));
    setEditPriority(item.priority || "Medium");
    setResolutionNotes(item.resolutionNotes || "");
    setSaveError("");
    setSaveSuccess("");
  }

  async function saveComplaint(event) {
    event.preventDefault();
    setSaving(true);
    setSaveError("");
    try {
      const changes = {
        status: editStatus,
        priority: editPriority,
        resolutionNotes: resolutionNotes.trim(),
        updatedAt: user?.isDemo ? new Date().toISOString() : serverTimestamp(),
      };
      if (user?.isDemo) {
        let found = false;
        const updatedComplaints = getPrototypeComplaints().map((item) => {
          if (item.id !== selectedComplaint.id) return item;
          found = true;
          return { ...item, ...changes };
        });
        if (!found) throw new Error("This complaint is no longer available. Refresh and try again.");
        savePrototypeComplaints(updatedComplaints);
      } else {
        await updateDoc(doc(db, "complaints", selectedComplaint.id), changes);
      }
      setSaveSuccess("Complaint updated.");
      setSelectedComplaint(null);
    } catch (error) {
      setSaveError(error.message || "Could not update this complaint.");
    } finally {
      setSaving(false);
    }
  }

  if (visibleAccess === "checking") return <div className="route-loading">Verifying administrator access...</div>;
  if (visibleAccess !== "allowed") {
    return <main className="admin-access-page"><div className="admin-access-card"><span><ShieldCheck size={24} /></span><h1>Administrator access required</h1><p>{visibleAccess === "unavailable" ? "Connect the Firebase project before opening the admin workspace." : "This Firebase account is not assigned an administrator role."}</p>{loadError && <small>{loadError}</small>}<Link to="/dashboard">Return to student dashboard</Link></div></main>;
  }

  return <div className="admin-shell">
    <aside className="admin-sidebar">
      <Link className="admin-brand" to="/admin"><span><ShieldCheck size={20} /></span><b>Smart Campus<small>ADMIN WORKSPACE</small></b></Link>
      <p className="admin-nav-label">MANAGEMENT</p>
      <nav className="admin-nav" aria-label="Admin navigation">
        <Link className={`admin-nav-link ${view === "overview" ? "active" : ""}`} to="/admin"><LayoutDashboard size={17} /> Overview</Link>
        <Link className={`admin-nav-link ${view === "complaints" ? "active" : ""}`} to="/admin/complaints"><ClipboardList size={17} /> Complaints</Link>
      </nav>
      <div className="admin-sidebar-bottom"><Link className="admin-nav-link" to="/dashboard"><Users size={17} /> Student portal</Link><button className="admin-signout" onClick={logOut}><LogOut size={16} /> Sign out</button><div className="admin-user"><span>{(user?.displayName || user?.email || "A").slice(0, 1).toUpperCase()}</span><div><strong>{user?.displayName || "Administrator"}</strong><small>{user?.email}</small></div></div></div>
    </aside>
    <main className="admin-main">
      <header className="admin-topbar"><div><span>Campus operations</span><i>/</i><strong>{view === "complaints" ? "Complaints" : "Overview"}</strong></div><span className="admin-secure"><ShieldCheck size={15} /> Admin session</span></header>
      <div className="admin-content">
        <div className="admin-page-heading"><div><span className="admin-eyebrow">CAMPUS SERVICE DESK</span><h1>{view === "complaints" ? "Complaint management" : "Operations overview"}</h1><p>{view === "complaints" ? "Review reports, update status, and leave resolution notes." : "A live view of student reports across campus."}</p></div><div className="admin-live"><i /> {user?.isDemo ? "Prototype data · saved locally" : "Live Firestore data"}</div></div>
        {loadError && <div className="admin-error" role="alert"><AlertTriangle size={17} />{loadError}</div>}
        {saveSuccess && <div className="admin-success" role="status"><Check size={16} />{saveSuccess}<button aria-label="Dismiss" onClick={() => setSaveSuccess("")}><X size={15} /></button></div>}
        <section className="admin-stats" aria-label="Complaint statistics">
          <AdminStat label="Total complaints" value={totals.all} icon={<FileText size={18} />} tone="blue" loading={loading} />
          <AdminStat label="Pending" value={totals.pending} icon={<Clock3 size={18} />} tone="amber" loading={loading} />
          <AdminStat label="In progress" value={totals.inProgress} icon={<Activity size={18} />} tone="teal" loading={loading} />
          <AdminStat label="Resolved" value={totals.resolved} icon={<Check size={18} />} tone="green" loading={loading} />
          <AdminStat label="High priority" value={totals.highPriority} icon={<AlertTriangle size={18} />} tone="red" loading={loading} />
        </section>
        {view === "overview" && <section className="admin-charts">
          <div className="admin-panel"><div className="admin-panel-heading"><div><span>WORKLOAD</span><h2>Complaints by status</h2></div><span className="admin-panel-tag">All time</span></div><div className="admin-bar-chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={statusData} margin={{ top: 12, right: 12, left: -20, bottom: 0 }}><CartesianGrid stroke="#edf1f5" vertical={false} /><XAxis axisLine={false} tickLine={false} tick={{ fill: "#8795a4", fontSize: 10 }} dataKey="name" /><YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fill: "#9aa6b3", fontSize: 9 }} /><Tooltip /><Bar dataKey="count" name="Complaints" radius={[4, 4, 0, 0]}>{statusData.map((item) => <Cell key={item.name} fill={item.color} />)}</Bar></BarChart></ResponsiveContainer></div></div>
          <div className="admin-panel"><div className="admin-panel-heading"><div><span>DISTRIBUTION</span><h2>By category</h2></div><span className="admin-panel-tag">{totals.all} total</span></div>{loading ? <div className="admin-chart-empty">Loading category data...</div> : categoryData.length ? <div className="admin-category-chart"><div className="admin-donut"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={categoryData} dataKey="value" nameKey="name" innerRadius="67%" outerRadius="92%" paddingAngle={3} stroke="none">{categoryData.map((item) => <Cell key={item.name} fill={item.color} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer><span><strong>{totals.all}</strong><small>reports</small></span></div><div className="admin-legend">{categoryData.slice(0, 6).map((item) => <div key={item.name}><i style={{ background: item.color }} /><span>{item.name}</span><strong>{item.value}</strong></div>)}</div></div> : <div className="admin-chart-empty">Category data will appear when complaints are submitted.</div>}</div>
        </section>}
        <section className="admin-panel admin-complaints-panel"><div className="admin-panel-heading admin-table-heading"><div><span>STUDENT REPORTS</span><h2>{view === "complaints" ? "All complaints" : "Recent complaints"}</h2></div><div className="admin-table-controls"><label><Search size={15} /><input aria-label="Search complaints" onChange={(event) => setSearchTerm(event.target.value)} placeholder="Search reports" value={searchTerm} /></label><select aria-label="Filter by complaint status" onChange={(event) => setStatusFilter(event.target.value)} value={statusFilter}><option>All statuses</option>{statusOptions.map((status) => <option key={status}>{status}</option>)}</select></div></div>
          {loading ? <div className="admin-chart-empty">Loading complaints...</div> : visibleComplaints.length ? <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>COMPLAINT</th><th>STUDENT ID</th><th>CATEGORY</th><th>SUBMITTED</th><th>PRIORITY</th><th>STATUS</th><th><span className="sr-only">Manage</span></th></tr></thead><tbody>{(view === "overview" ? visibleComplaints.slice(0, 8) : visibleComplaints).map((item) => <tr key={item.id}><td><strong>{item.title || "Untitled complaint"}</strong><small>#{item.id.slice(0, 8).toUpperCase()}</small></td><td className="admin-student-id">{item.studentId || "Unknown"}</td><td>{item.category || "Other"}</td><td>{formatDate(item.createdAt)}</td><td><PriorityPill value={item.priority || "Medium"} /></td><td><StatusPill value={normalizeStatus(item.status)} /></td><td><button className="admin-manage-button" onClick={() => openComplaint(item)}>Manage</button></td></tr>)}</tbody></table></div> : <div className="admin-chart-empty">No complaints match these filters.</div>}
          {view === "overview" && visibleComplaints.length > 8 && <div className="admin-table-footer"><span>Showing 8 of {visibleComplaints.length}</span><Link to="/admin/complaints">View all complaints <ArrowUpRight size={14} /></Link></div>}
        </section>
      </div>
    </main>
    {selectedComplaint && <div className="admin-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedComplaint(null); }}><section aria-labelledby="edit-complaint-title" aria-modal="true" className="admin-edit-modal" role="dialog"><header><div><span>COMPLAINT #{selectedComplaint.id.slice(0, 8).toUpperCase()}</span><h2 id="edit-complaint-title">{selectedComplaint.title || "Untitled complaint"}</h2></div><button aria-label="Close" onClick={() => setSelectedComplaint(null)}><X size={18} /></button></header><div className="admin-complaint-detail"><span>{selectedComplaint.category || "Other"}</span><span>{formatDate(selectedComplaint.createdAt)}</span><span>{selectedComplaint.location || "Location not provided"}</span></div><p className="admin-complaint-description">{selectedComplaint.description || "No description provided."}</p>{selectedComplaint.imageUrl && <img alt="Complaint attachment" className="admin-complaint-image" src={selectedComplaint.imageUrl} />}<form onSubmit={saveComplaint}><label>Status<select onChange={(event) => setEditStatus(event.target.value)} value={editStatus}>{statusOptions.map((status) => <option key={status}>{status}</option>)}</select></label><label>Priority<select onChange={(event) => setEditPriority(event.target.value)} value={editPriority}>{priorityOptions.map((priority) => <option key={priority}>{priority}</option>)}</select></label><label>Resolution notes<textarea onChange={(event) => setResolutionNotes(event.target.value)} placeholder="Add a note for the student" rows={3} value={resolutionNotes} /></label>{saveError && <p className="admin-modal-error" role="alert">{saveError}</p>}<footer><button className="admin-cancel" onClick={() => setSelectedComplaint(null)} type="button">Cancel</button><button className="admin-save" disabled={saving} type="submit"><Check size={15} />{saving ? "Saving..." : "Save changes"}</button></footer></form></section></div>}
  </div>;
}

function AdminStat({ label, value, icon, tone, loading }) {
  return <article className={`admin-stat admin-stat-${tone}`}><div className="admin-stat-icon">{icon}</div><div className="admin-stat-value">{loading ? "–" : value}</div><div className="admin-stat-label">{label}</div><span className="admin-stat-trend">{tone === "red" ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}</span></article>;
}

function PriorityPill({ value }) {
  return <span className={`admin-priority admin-priority-${value.toLowerCase()}`}><i />{value}</span>;
}

function StatusPill({ value }) {
  return <span className={`admin-status admin-status-${value.toLowerCase().replaceAll(" ", "-")}`}><i />{value}</span>;
}