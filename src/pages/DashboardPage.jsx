import { useEffect, useRef, useState } from "react";
import { Bell, CheckCircle2, ChevronDown, CircleHelp, ClipboardList, Clock3, FilePlus2, ImagePlus, LayoutDashboard, LogOut, Menu, MessageSquareText, Plus, QrCode, Radio, Search, Send, Wifi, X } from "lucide-react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { addDoc, collection, onSnapshot, query, serverTimestamp, where } from "firebase/firestore";
import { db } from "../firebase.js";
import { useAuth } from "../auth/useAuth.js";
import {
  createPrototypeComplaintId,
  getPrototypeComplaints,
  savePrototypeComplaints,
  subscribeToPrototypeComplaints,
} from "../data/prototypeData.js";

const categoryColors = ["#3670d4", "#35a88e", "#e7a746", "#dc6f71", "#8a79c5", "#5ba9bd"];
const MAX_IMAGE_SIZE = 500 * 1024;
const initialComplaint = { title: "", description: "", category: "Hostel", location: "", priority: "Medium", imageUrl: "" };
function statusName(value = "Pending") {
  const normalized = value.toLowerCase().replaceAll("_", " ").trim();
  if (["resolved", "closed"].includes(normalized)) return "Resolved";
  if (["in progress", "in-progress"].includes(normalized)) return "In progress";
  return "Pending";
}
function dateValue(value) { return value?.toDate ? value.toDate() : value ? new Date(value) : null; }
function formatDate(value) {
  const date = dateValue(value);
  if (!date || Number.isNaN(date.getTime())) return "Date unavailable";
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(date);
}
function greeting() {
  const hour = new Date().getHours();
  return hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
}

export default function DashboardPage() {
  const { user, logOut } = useAuth();
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dataError, setDataError] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [activePanel, setActivePanel] = useState("");
  const [formData, setFormData] = useState(initialComplaint);
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [statusFilter, setStatusFilter] = useState("All statuses");
  const [searchTerm, setSearchTerm] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [manualLocation, setManualLocation] = useState("");
  const imageInputRef = useRef(null);

  useEffect(() => {
    if (user?.isDemo) {
      const refreshPrototypeComplaints = () => {
        try {
          const results = getPrototypeComplaints()
            .filter((item) => item.studentId === user.uid)
            .sort((a, b) => (dateValue(b.createdAt)?.getTime() ?? 0) - (dateValue(a.createdAt)?.getTime() ?? 0));
          setComplaints(results);
          setDataError("");
        } catch (error) {
          setDataError(error.message || "Could not load prototype complaints.");
        } finally {
          setLoading(false);
        }
      };
      queueMicrotask(refreshPrototypeComplaints);
      return subscribeToPrototypeComplaints(refreshPrototypeComplaints);
    }
    if (!db || !user) return undefined;
    const complaintsQuery = query(collection(db, "complaints"), where("studentId", "==", user.uid));
    return onSnapshot(complaintsQuery, (snapshot) => {
      const results = snapshot.docs.map((item) => ({ id: item.id, ...item.data() })).sort((a, b) => (dateValue(b.createdAt)?.getTime() ?? 0) - (dateValue(a.createdAt)?.getTime() ?? 0));
      setComplaints(results); setDataError(""); setLoading(false);
    }, (error) => { setDataError(error.message || "Could not load your complaints."); setLoading(false); });
  }, [user]);

  const totals = {
    all: complaints.length,
    pending: complaints.filter((item) => statusName(item.status) === "Pending").length,
    inProgress: complaints.filter((item) => statusName(item.status) === "In progress").length,
    resolved: complaints.filter((item) => statusName(item.status) === "Resolved").length,
  };
  const categoryTotals = Object.entries(complaints.reduce((counts, item) => {
    const category = item.category || "Other";
    counts[category] = (counts[category] ?? 0) + 1;
    return counts;
  }, {})).map(([name, value], index) => ({ name, value, color: categoryColors[index % categoryColors.length] })).sort((a, b) => b.value - a.value);
  const studentName = user?.displayName?.trim().split(/\s+/)[0] || "Student";
  const initials = (user?.displayName || user?.email || "S").charAt(0).toUpperCase();
  const filteredComplaints = complaints.filter((item) => {
    const matchesStatus = statusFilter === "All statuses" || statusName(item.status) === statusFilter;
    const searchableText = `${item.title ?? ""} ${item.id} ${item.category ?? ""}`.toLowerCase();
    return matchesStatus && searchableText.includes(searchTerm.toLowerCase());
  });
  const displayedComplaints = showAll ? filteredComplaints : filteredComplaints.slice(0, 5);

  function openComplaintList(filter = "All statuses") {
    setActivePanel("");
    setStatusFilter(filter);
    setShowAll(true);
    requestAnimationFrame(() => document.getElementById("recent-complaints")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  async function handleComplaintSubmit(event) {
    event.preventDefault();
    setFormError("");
    setFormSuccess("");
    if (!user?.isDemo && !db) {
      setFormError("Connect your Firebase project before submitting a complaint.");
      return;
    }

    setSubmitting(true);
    try {
      const complaint = {
        ...formData,
        title: formData.title.trim(),
        description: formData.description.trim(),
        location: formData.location.trim(),
        studentId: user.uid,
        status: "Pending",
        ...(user?.isDemo ? {
          id: createPrototypeComplaintId(),
          studentName: user.displayName || "Student",
          createdAt: new Date().toISOString(),
        } : {
          createdAt: serverTimestamp(),
          ...(formData.imageUrl ? { imageUrl: formData.imageUrl } : {}),
        }),
      };
      if (user?.isDemo) {
        savePrototypeComplaints([complaint, ...getPrototypeComplaints()]);
      } else {
        await addDoc(collection(db, "complaints"), complaint);
      }
      setFormData(initialComplaint);
      if (imageInputRef.current) imageInputRef.current.value = "";
      setActivePanel("");
      setFormSuccess("Your complaint was submitted. You can track its status in Recent complaints.");
    } catch (error) {
      setFormError(error.message || "Your complaint could not be submitted. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  function handleImageChange(event) {
    const file = event.target.files?.[0];
    if (!file) {
      setFormData((current) => ({ ...current, imageUrl: "" }));
      return;
    }
    if (!file.type.startsWith("image/")) {
      setFormError("Choose an image file to attach.");
      event.target.value = "";
      return;
    }
    if (file.size > MAX_IMAGE_SIZE) {
      setFormError("Choose an image smaller than 500 KB so it can be saved with this prototype.");
      event.target.value = "";
      return;
    }
    setFormError("");
    const reader = new FileReader();
    reader.onload = () => setFormData((current) => ({ ...current, imageUrl: String(reader.result) }));
    reader.onerror = () => setFormError("The image could not be read. Please try another file.");
    reader.readAsDataURL(file);
  }

  function showActionPanel(panel) {
    setFormError("");
    setFormSuccess("");
    setActivePanel((current) => current === panel ? "" : panel);
    if (panel === "submit" || panel === "scan") {
      requestAnimationFrame(() => document.getElementById("dashboard-actions")?.scrollIntoView({ behavior: "smooth", block: "start" }));
    }
  }

  return <div className="dashboard-shell">
    {sidebarOpen && <button aria-label="Close navigation" className="sidebar-backdrop" onClick={() => setSidebarOpen(false)} />}
    <aside className={`sidebar ${sidebarOpen ? "sidebar-open" : ""}`}>
      <div className="sidebar-brand-row"><a className="sidebar-brand" href="/dashboard"><span className="brand-mark"><GraduationMark /></span><span>Smart Campus<small>STUDENT SERVICES</small></span></a><button aria-label="Close navigation" className="icon-button sidebar-close" onClick={() => setSidebarOpen(false)}><X size={18} /></button></div>
      <div className="sidebar-section-label">WORKSPACE</div>
      <nav className="sidebar-nav" aria-label="Main navigation"><a aria-current="page" className="sidebar-link active" href="/dashboard"><LayoutDashboard size={18} /> Overview</a><button className="sidebar-link sidebar-link-button" onClick={() => openComplaintList()}><ClipboardList size={18} /> My complaints</button></nav>
      <div className="sidebar-bottom"><div className="sidebar-help"><div className="help-icon"><CircleHelp size={17} /></div><div><strong>Need a hand?</strong><span>Campus support</span></div><ChevronDown size={15} /></div><div className="sidebar-profile"><div className="avatar sidebar-avatar">{initials}</div><div className="profile-info"><strong>{user?.displayName || "Student"}</strong><span>Student account</span></div><button aria-label="Sign out" className="icon-button logout-button" onClick={logOut} title="Sign out"><LogOut size={17} /></button></div></div>
    </aside>
    <main className="dashboard-main">
      <header className="dashboard-topbar"><button aria-label="Open navigation" className="icon-button mobile-menu" onClick={() => setSidebarOpen(true)}><Menu size={20} /></button><div className="breadcrumb"><span>Student portal</span><span className="breadcrumb-separator">/</span><strong>Overview</strong></div><div className="topbar-actions"><span className={user?.isDemo ? "campus-status demo-mode-label" : "campus-status"}><span />{user?.isDemo ? "Prototype · saved locally" : "Campus services"}</span><button aria-label="Show pending complaints" className="icon-button notification-button" onClick={() => openComplaintList("Pending")} title="Show pending complaints"><Bell size={18} /><i /></button><div className="profile-menu-wrap"><button aria-expanded={profileOpen} className="topbar-profile" onClick={() => setProfileOpen((open) => !open)}><span className="avatar">{initials}</span><span className="topbar-profile-name">{studentName}</span><ChevronDown size={15} /></button>{profileOpen && <div className="profile-dropdown"><span>{user?.email}</span><button onClick={logOut}><LogOut size={15} /> Sign out</button></div>}</div></div></header>
      <div className="dashboard-content">
        <section className="dashboard-welcome"><div><div className="welcome-date">STUDENT OVERVIEW <span /> YOUR CAMPUS REQUESTS</div><h1>{greeting()}, {studentName}<span className="welcome-comma">.</span></h1><p>Here’s what’s happening with your campus requests.</p></div><div className="welcome-illustration" aria-hidden="true"><div className="illustration-sun" /><div className="illustration-building"><i /><i /><i /><i /><i /><i /></div><div className="illustration-ground" /></div></section>
        {formSuccess && <div className="success-banner" role="status"><CheckCircle2 size={18} /><span>{formSuccess}</span><button aria-label="Dismiss success message" onClick={() => setFormSuccess("")}><X size={16} /></button></div>}
        <section className="quick-actions" id="dashboard-actions" aria-label="Quick actions">
          <div className="quick-actions-heading"><div><span className="panel-kicker">CAMPUS SERVICES</span><h2>What can we help with?</h2></div><span>Choose a quick action</span></div>
          <div className="quick-actions-grid">
            <button className={`quick-action quick-action-primary ${activePanel === "submit" ? "quick-action-selected" : ""}`} onClick={() => showActionPanel("submit")}><span className="quick-action-icon"><Plus size={19} /></span><span><strong>Submit complaint</strong><small>Tell us what needs attention</small></span><span className="quick-action-arrow">›</span></button>
            <button className="quick-action" onClick={() => openComplaintList()}><span className="quick-action-icon"><ClipboardList size={19} /></span><span><strong>My complaints</strong><small>Review your submitted requests</small></span><span className="quick-action-arrow">›</span></button>
            <button className="quick-action" onClick={() => openComplaintList("Pending")}><span className="quick-action-icon"><Search size={19} /></span><span><strong>Track status</strong><small>See requests awaiting an update</small></span><span className="quick-action-arrow">›</span></button>
            <button className={`quick-action ${activePanel === "scan" ? "quick-action-selected" : ""}`} onClick={() => showActionPanel("scan")}><span className="quick-action-icon"><QrCode size={19} /></span><span><strong>Scan QR</strong><small>Open a location-linked report</small></span><span className="quick-action-arrow">›</span></button>
          </div>
        </section>
        {activePanel === "submit" && <section className="action-panel" aria-labelledby="submit-heading"><div className="action-panel-heading"><div><span className="panel-kicker">NEW CAMPUS REQUEST</span><h2 id="submit-heading">Submit a complaint</h2></div><button aria-label="Close complaint form" className="icon-button" onClick={() => setActivePanel("")}><X size={18} /></button></div><form className="complaint-form" onSubmit={handleComplaintSubmit}><label>Title<input maxLength={100} onChange={(event) => setFormData({ ...formData, title: event.target.value })} placeholder="Briefly describe the issue" required value={formData.title} /></label><label>Category<select onChange={(event) => setFormData({ ...formData, category: event.target.value })} value={formData.category}><option>Hostel</option><option>Mess</option><option>Wi-Fi</option><option>Classroom</option><option>Transport</option><option>Other</option></select></label><label>Location<input maxLength={120} onChange={(event) => setFormData({ ...formData, location: event.target.value })} placeholder="Building, room, or campus area" required value={formData.location} /></label><label>Priority<select onChange={(event) => setFormData({ ...formData, priority: event.target.value })} value={formData.priority}><option>Low</option><option>Medium</option><option>High</option></select></label><label className="complaint-description">Description<textarea maxLength={2000} onChange={(event) => setFormData({ ...formData, description: event.target.value })} placeholder="Add details that will help the campus team respond" required rows={4} value={formData.description} /></label><label className="complaint-image-field"><span>Attach an image <small>(optional, up to 500 KB)</small></span><span className="image-upload-control"><ImagePlus size={16} /><input accept="image/*" onChange={handleImageChange} ref={imageInputRef} type="file" /></span>{formData.imageUrl && <img alt="Complaint attachment preview" className="complaint-image-preview" src={formData.imageUrl} />}</label>{formError && <p className="form-error" role="alert">{formError}</p>}<div className="complaint-form-footer"><span>Your complaint will be visible to you and authorized campus staff.</span><button className="form-submit" disabled={submitting} type="submit"><Send size={16} />{submitting ? "Submitting..." : "Submit complaint"}</button></div></form></section>}
        {activePanel === "scan" && <section className="action-panel scan-panel"><div className="action-panel-heading"><div><span className="panel-kicker">LOCATION REPORTING</span><h2>Report from a campus QR code</h2></div><button aria-label="Close QR reporting" className="icon-button" onClick={() => setActivePanel("")}><X size={18} /></button></div><div className="scan-content"><span className="scan-icon"><QrCode size={25} /></span><div><strong>Camera scanning is not configured yet.</strong><p>Enter the location printed beside the campus QR code to start a location-specific complaint.</p><div className="scan-entry"><input aria-label="Campus location" onChange={(event) => setManualLocation(event.target.value)} placeholder="For example: North Hostel, Block B" value={manualLocation} /><button disabled={!manualLocation.trim()} onClick={() => { setFormData({ ...formData, location: manualLocation.trim() }); setActivePanel("submit"); }} type="button">Continue to report</button></div></div></div></section>}
        {dataError && <div className="data-error" role="alert"><Wifi size={18} /><div><strong>We couldn’t load your complaints.</strong><span>{dataError}</span></div></div>}
        <section className="stats-grid" aria-label="Complaint summary"><StatCard label="Total complaints" value={totals.all} icon={<MessageSquareText size={19} />} tone="blue" loading={loading} note="All time" /><StatCard label="Pending" value={totals.pending} icon={<Clock3 size={19} />} tone="amber" loading={loading} note="Awaiting review" /><StatCard label="In progress" value={totals.inProgress} icon={<Radio size={19} />} tone="teal" loading={loading} note="Being addressed" /><StatCard label="Resolved" value={totals.resolved} icon={<CheckCircle2 size={19} />} tone="green" loading={loading} note="Successfully closed" /></section>
        <section className="dashboard-panels">
          <div className="panel recent-panel" id="recent-complaints"><div className="panel-heading"><div><span className="panel-kicker">YOUR ACTIVITY</span><h2>Recent complaints</h2></div><div className="complaint-controls"><label className="search-control"><Search size={15} /><input aria-label="Search complaints" onChange={(event) => setSearchTerm(event.target.value)} placeholder="Search" value={searchTerm} /></label><select aria-label="Filter by status" id="complaint-filter" onChange={(event) => setStatusFilter(event.target.value)} value={statusFilter}><option>All statuses</option><option>Pending</option><option>In progress</option><option>Resolved</option></select></div></div>
            {loading ? <div className="complaint-loading"><span className="spinner" /> Loading your complaints...</div> : displayedComplaints.length === 0 ? <div className="empty-state"><div className="empty-icon"><FilePlus2 size={21} /></div><strong>{complaints.length ? "No matching complaints" : "No complaints yet"}</strong><p>{complaints.length ? "Try a different status or search term." : "Your submitted campus requests will appear here."}</p></div> : <div className="complaint-table-wrap"><table className="complaint-table"><thead><tr><th>COMPLAINT</th><th>CATEGORY</th><th>DATE</th><th>PRIORITY</th><th>STATUS</th></tr></thead><tbody>{displayedComplaints.map((item) => <tr key={item.id}><td><strong>{item.title || "Untitled complaint"}</strong><span>#{item.id.slice(0, 8).toUpperCase()}</span></td><td>{item.category || "Other"}</td><td>{formatDate(item.createdAt)}</td><td><PriorityBadge priority={item.priority || "Medium"} /></td><td><StatusBadge status={statusName(item.status)} /></td></tr>)}</tbody></table></div>}
            {!loading && filteredComplaints.length > 5 && <div className="panel-footnote">Showing {displayedComplaints.length} of {filteredComplaints.length} complaints <button onClick={() => setShowAll((value) => !value)}>{showAll ? "Show recent" : "Show all"}</button></div>}
          </div>
          <div className="panel category-panel"><div className="panel-heading"><div><span className="panel-kicker">AT A GLANCE</span><h2>By category</h2></div><span className="panel-period">All time</span></div>
            {loading ? <div className="chart-loading"><span className="spinner" /></div> : categoryTotals.length === 0 ? <div className="chart-empty"><div className="chart-empty-ring" /><span>Category insights will appear<br />after your first complaint.</span></div> : <><div className="chart-wrap"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={categoryTotals} dataKey="value" nameKey="name" innerRadius="66%" outerRadius="91%" paddingAngle={3} stroke="none">{categoryTotals.map((item) => <Cell key={item.name} fill={item.color} />)}</Pie><Tooltip formatter={(value, name) => [`${value} ${value === 1 ? "complaint" : "complaints"}`, name]} /></PieChart></ResponsiveContainer><div className="chart-center"><strong>{totals.all}</strong><span>total</span></div></div><div className="category-legend">{categoryTotals.slice(0, 5).map((item) => <div className="legend-row" key={item.name}><span className="legend-dot" style={{ backgroundColor: item.color }} /><span>{item.name}</span><strong>{item.value}</strong></div>)}</div></>}
          </div>
        </section>
        <div className="dashboard-bottom-note"><span className="bottom-note-icon"><ShieldCheckIcon /></span><span>Your complaints are visible only to you and authorized campus staff.</span><a href="mailto:campus-support@example.edu">Contact support</a></div>
      </div>
    </main>
  </div>;
}

function GraduationMark() {
  return <svg aria-hidden="true" viewBox="0 0 24 24"><path d="m2.8 9 9.2-5 9.2 5-9.2 5-9.2-5Z" /><path d="M6.8 11.2v4.2c3.2 2.5 7.2 2.5 10.4 0v-4.2M21.2 9v5" /></svg>;
}
function ShieldCheckIcon() {
  return <svg aria-hidden="true" viewBox="0 0 20 20"><path d="M10 2.5 16 5v4.2c0 3.8-2.6 6.4-6 8.3-3.4-1.9-6-4.5-6-8.3V5l6-2.5Z" /><path d="m7.4 9.7 1.7 1.7 3.7-3.8" /></svg>;
}
function StatCard({ label, value, icon, tone, loading, note }) {
  return <article className={`stat-card tone-${tone}`}><div className="stat-topline"><span className="stat-icon">{icon}</span><span className="stat-note">{note}</span></div><div className="stat-value">{loading ? <span className="stat-skeleton" /> : value}</div><div className="stat-label">{label}</div></article>;
}
function StatusBadge({ status }) {
  const tone = status.toLowerCase().replaceAll(" ", "-");
  return <span className={`status-badge status-${tone}`}><i />{status}</span>;
}
function PriorityBadge({ priority }) {
  const tone = priority.toLowerCase();
  return <span className={`priority-badge priority-${tone}`}>{priority}</span>;
}
