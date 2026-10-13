const COMPLAINTS_KEY = "smart-campus-prototype-complaints";
const SESSION_KEY = "smart-campus-demo-session";
const COMPLAINTS_EVENT = "smart-campus-prototype-complaints-changed";

function getSeedComplaints() {
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  return [
    {
      id: "SC-2401",
      studentId: "demo-student",
      studentName: "Bhavana",
      title: "Water cooler not working",
      description: "The water cooler on the second floor has not been dispensing cold water since yesterday.",
      category: "Hostel",
      location: "North Hostel, Block B · Floor 2",
      priority: "Medium",
      status: "In Progress",
      createdAt: new Date(now - day).toISOString(),
      resolutionNotes: "",
    },
    {
      id: "SC-2402",
      studentId: "demo-student",
      studentName: "Bhavana",
      title: "Wi-Fi signal drops in the library",
      description: "The connection keeps dropping in the east wing study area, especially in the evening.",
      category: "Wi-Fi",
      location: "Central Library · East Wing",
      priority: "High",
      status: "Pending",
      createdAt: new Date(now - day * 2).toISOString(),
      resolutionNotes: "",
    },
    {
      id: "SC-2403",
      studentId: "demo-student",
      studentName: "Bhavana",
      title: "Projector lamp replaced",
      description: "The projector in the lecture hall had a dim display. The campus team replaced the lamp.",
      category: "Classroom",
      location: "Academic Block · Lecture Hall 3",
      priority: "Low",
      status: "Resolved",
      createdAt: new Date(now - day * 5).toISOString(),
      resolutionNotes: "Projector lamp replaced and display tested.",
    },
    {
      id: "SC-2404",
      studentId: "demo-student",
      studentName: "Bhavana",
      title: "Evening shuttle running late",
      description: "The evening shuttle has been arriving about 15 minutes behind schedule this week.",
      category: "Transport",
      location: "Main Gate · Shuttle Stop",
      priority: "Medium",
      status: "Pending",
      createdAt: new Date(now - day * 7).toISOString(),
      resolutionNotes: "",
    },
  ];
}

export function getPrototypeComplaints() {
  const saved = localStorage.getItem(COMPLAINTS_KEY);
  if (saved !== null) {
    try {
      const complaints = JSON.parse(saved);
      if (!Array.isArray(complaints)) throw new Error("Complaint data must be a list.");
      const updatedComplaints = complaints.map((complaint) => (
        complaint.studentId === "demo-student" && complaint.studentName !== "Bhavana"
          ? { ...complaint, studentName: "Bhavana" }
          : complaint
      ));
      if (updatedComplaints.some((complaint, index) => complaint !== complaints[index])) {
        localStorage.setItem(COMPLAINTS_KEY, JSON.stringify(updatedComplaints));
      }
      return updatedComplaints;
    } catch (error) {
      throw new Error(`Saved prototype complaints could not be read: ${error.message}`);
    }
  }

  const samples = getSeedComplaints();
  savePrototypeComplaints(samples);
  return samples;
}

export function savePrototypeComplaints(complaints) {
  localStorage.setItem(COMPLAINTS_KEY, JSON.stringify(complaints));
  window.dispatchEvent(new CustomEvent(COMPLAINTS_EVENT));
}

export function subscribeToPrototypeComplaints(onChange) {
  const handleChange = () => onChange();
  window.addEventListener(COMPLAINTS_EVENT, handleChange);
  window.addEventListener("storage", handleChange);
  return () => {
    window.removeEventListener(COMPLAINTS_EVENT, handleChange);
    window.removeEventListener("storage", handleChange);
  };
}

export function createPrototypeComplaintId() {
  return `SC-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

export function getDemoSession() {
  const saved = localStorage.getItem(SESSION_KEY);
  if (!saved) return null;
  try {
    const session = JSON.parse(saved);
    if (!session?.isDemo || !["student", "admin"].includes(session.role)) return null;
    if (session.role === "student" && session.displayName !== "Bhavana") {
      session.displayName = "Bhavana";
      saveDemoSession(session);
    }
    return session;
  } catch (error) {
    throw new Error(`Saved demo session could not be read: ${error.message}`);
  }
}

export function saveDemoSession(session) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function clearDemoSession() {
  localStorage.removeItem(SESSION_KEY);
}
