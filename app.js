const STORAGE_KEY = "worklog_entries_v1";

const state = {
  entries: loadEntries(),
  selectedType: "Overtime",
  timerStartTs: null,
  timerElapsedMs: 0,
  timerInterval: null,
  recognition: null,
  listening: false,
};

const refs = {
  todayLabel: document.getElementById("todayLabel"),
  dateInput: document.getElementById("dateInput"),
  clientInput: document.getElementById("clientInput"),
  startInput: document.getElementById("startInput"),
  endInput: document.getElementById("endInput"),
  hoursInput: document.getElementById("hoursInput"),
  activityInput: document.getElementById("activityInput"),
  reasonInput: document.getElementById("reasonInput"),
  saveBtn: document.getElementById("saveBtn"),
  clearBtn: document.getElementById("clearBtn"),
  smartInput: document.getElementById("smartInput"),
  parseBtn: document.getElementById("parseBtn"),
  voiceBtn: document.getElementById("voiceBtn"),
  voiceStatus: document.getElementById("voiceStatus"),
  suggestions: document.getElementById("suggestions"),
  entryList: document.getElementById("entryList"),
  monthInput: document.getElementById("monthInput"),
  summaryCards: document.getElementById("summaryCards"),
  exportCsvBtn: document.getElementById("exportCsvBtn"),
  exportPdfBtn: document.getElementById("exportPdfBtn"),
  timerDisplay: document.getElementById("timerDisplay"),
  startTimerBtn: document.getElementById("startTimerBtn"),
  stopTimerBtn: document.getElementById("stopTimerBtn"),
  applyTimerBtn: document.getElementById("applyTimerBtn"),
};

init();

function init() {
  const today = new Date();
  refs.todayLabel.textContent = formatDateHuman(today);
  refs.dateInput.value = formatDateISO(today);
  refs.monthInput.value = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;

  bindTabs();
  bindTypePills();
  bindActions();
  initVoice();
  renderAll();
  renderSummary();
  renderSuggestions();
  updateTimerDisplay();
}

function bindTabs() {
  const tabs = document.querySelectorAll(".tab");
  const panels = document.querySelectorAll(".panel");
  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      tabs.forEach((t) => t.classList.remove("active"));
      panels.forEach((p) => p.classList.remove("active"));
      tab.classList.add("active");
      const id = tab.dataset.tab;
      document.getElementById(id).classList.add("active");
      if (id === "all") renderAll();
      if (id === "summary") renderSummary();
    });
  });
}

function bindTypePills() {
  document.querySelectorAll(".pill").forEach((pill) => {
    pill.addEventListener("click", () => {
      document.querySelectorAll(".pill").forEach((p) => p.classList.remove("active"));
      pill.classList.add("active");
      state.selectedType = pill.dataset.type;
    });
  });
}

function bindActions() {
  refs.saveBtn.addEventListener("click", saveEntry);
  refs.clearBtn.addEventListener("click", clearForm);
  refs.parseBtn.addEventListener("click", parseSmartInput);
  refs.voiceBtn.addEventListener("click", toggleVoiceInput);
  refs.monthInput.addEventListener("change", renderSummary);
  refs.exportCsvBtn.addEventListener("click", exportCsv);
  refs.exportPdfBtn.addEventListener("click", exportPdf);
  refs.startTimerBtn.addEventListener("click", startTimer);
  refs.stopTimerBtn.addEventListener("click", stopTimer);
  refs.applyTimerBtn.addEventListener("click", applyTimerToHours);
}

function saveEntry() {
  const entry = {
    id: crypto.randomUUID(),
    type: state.selectedType,
    date: refs.dateInput.value || formatDateISO(new Date()),
    client: refs.clientInput.value.trim(),
    start: refs.startInput.value || "",
    end: refs.endInput.value || "",
    hours: parseFloat(refs.hoursInput.value || "0"),
    activity: refs.activityInput.value.trim(),
    reason: refs.reasonInput.value.trim(),
    projectTag: autoTagProject({
      client: refs.clientInput.value,
      activity: refs.activityInput.value,
      reason: refs.reasonInput.value,
      type: state.selectedType,
    }),
    createdAt: new Date().toISOString(),
  };

  if (!entry.client || !entry.activity || !entry.hours) {
    alert("Please fill client, activity, and hours.");
    return;
  }

  state.entries.unshift(entry);
  persistEntries();
  renderAll();
  renderSummary();
  renderSuggestions();
  clearForm(false);
  alert(`Saved with tag: ${entry.projectTag}`);
}

function clearForm(resetDate = false) {
  if (resetDate) refs.dateInput.value = formatDateISO(new Date());
  refs.clientInput.value = "";
  refs.startInput.value = "";
  refs.endInput.value = "";
  refs.hoursInput.value = "";
  refs.activityInput.value = "";
  refs.reasonInput.value = "";
  refs.smartInput.value = "";
}

function parseSmartInput() {
  const text = refs.smartInput.value.trim();
  if (!text) return;
  const parsed = parseText(text);
  if (parsed.type) setSelectedType(parsed.type);
  if (parsed.client) refs.clientInput.value = parsed.client;
  if (parsed.start) refs.startInput.value = parsed.start;
  if (parsed.end) refs.endInput.value = parsed.end;
  if (parsed.hours) refs.hoursInput.value = parsed.hours.toString();
  if (parsed.activity) refs.activityInput.value = parsed.activity;
  if (parsed.reason) refs.reasonInput.value = parsed.reason;
  if (!parsed.type || !parsed.client) {
    const learned = getLearnedSuggestion(text);
    if (!parsed.type && learned.type) setSelectedType(learned.type);
    if (!parsed.client && learned.client) refs.clientInput.value = learned.client;
  }
}

function parseText(text) {
  const lower = text.toLowerCase();
  const result = { activity: text };

  if (lower.includes("overtime")) result.type = "Overtime";
  if (lower.includes("execution")) result.type = "Offsite Execution";
  if (lower.includes("overview")) result.type = "Offsite Overview";

  const range = text.match(/(\d{1,2}[:.]\d{2})\s*[-to]+\s*(\d{1,2}[:.]\d{2})/i);
  if (range) {
    result.start = toTime(range[1]);
    result.end = toTime(range[2]);
    result.hours = calcHours(result.start, result.end);
  }

  const hrs = text.match(/(\d+(?:\.\d+)?)\s*(h|hr|hrs|hour|hours)\b/i);
  if (hrs) result.hours = parseFloat(hrs[1]);

  const clientByFor = text.match(/\bfor\s+([A-Za-z0-9&.\-\s]{2,40})/i);
  const clientByAt = text.match(/\bat\s+([A-Za-z0-9&.\-\s]{2,40})/i);
  const clientByWith = text.match(/\bwith\s+([A-Za-z0-9&.\-\s]{2,40})/i);
  result.client = cleanClient((clientByFor && clientByFor[1]) || (clientByAt && clientByAt[1]) || "");
  if (!result.client && clientByWith) result.client = cleanClient(clientByWith[1]);

  const reason = text.match(/\b(reason|because)\s*[:\-]?\s*(.+)$/i);
  if (reason) result.reason = reason[2].trim();

  if (!result.client) {
    const brandHints = ["nike", "adidas", "puma", "apple", "google", "meta", "amazon", "microsoft"];
    const hint = brandHints.find((b) => lower.includes(b));
    if (hint) result.client = hint[0].toUpperCase() + hint.slice(1);
  }

  return result;
}

function autoTagProject(data) {
  const raw = `${data.client} ${data.activity} ${data.reason} ${data.type}`.toLowerCase();
  if (raw.includes("shoot") || raw.includes("camera") || raw.includes("photo")) return "Media Production";
  if (raw.includes("meeting") || raw.includes("sync")) return "Coordination";
  if (raw.includes("report") || raw.includes("summary")) return "Reporting";
  if (raw.includes("install") || raw.includes("setup") || raw.includes("execution")) return "Field Ops";
  return "General";
}

function initVoice() {
  const SpeechCtor = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechCtor) {
    refs.voiceBtn.disabled = true;
    refs.voiceStatus.textContent = "Voice input is not supported on this browser.";
    return;
  }

  state.recognition = new SpeechCtor();
  state.recognition.lang = "en-US";
  state.recognition.interimResults = false;
  state.recognition.maxAlternatives = 1;

  state.recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript || "";
    refs.smartInput.value = transcript;
    refs.voiceStatus.textContent = `Heard: ${transcript}`;
    parseSmartInput();
  };

  state.recognition.onstart = () => {
    state.listening = true;
    refs.voiceStatus.textContent = "Listening...";
    refs.voiceBtn.textContent = "Stop Listening";
  };

  state.recognition.onend = () => {
    state.listening = false;
    refs.voiceBtn.textContent = "Speak to Fill Form";
    if (refs.voiceStatus.textContent === "Listening...") {
      refs.voiceStatus.textContent = "Voice input stopped.";
    }
  };

  state.recognition.onerror = (event) => {
    refs.voiceStatus.textContent = `Voice error: ${event.error || "unknown"}`;
  };
}

function toggleVoiceInput() {
  if (!state.recognition) return;
  if (state.listening) {
    state.recognition.stop();
    return;
  }
  refs.voiceStatus.textContent = "Requesting microphone...";
  state.recognition.start();
}

function renderAll() {
  refs.entryList.innerHTML = "";
  if (!state.entries.length) {
    refs.entryList.innerHTML = '<div class="entry"><div class="meta">No entries yet.</div></div>';
    return;
  }
  state.entries.forEach((e) => {
    const div = document.createElement("div");
    div.className = "entry";
    div.innerHTML = `
      <div class="title">${escapeHtml(e.type)} - ${escapeHtml(e.client)}</div>
      <div class="meta">${escapeHtml(e.date)} | ${e.hours} hrs | ${escapeHtml(e.projectTag)}</div>
      <div>${escapeHtml(e.activity || "")}</div>
    `;
    refs.entryList.appendChild(div);
  });
}

function renderSummary() {
  const month = refs.monthInput.value;
  const monthly = state.entries.filter((e) => e.date.startsWith(month));
  const byType = {
    Overtime: 0,
    "Offsite Execution": 0,
    "Offsite Overview": 0,
  };
  monthly.forEach((e) => {
    if (byType[e.type] !== undefined) byType[e.type] += 1;
  });

  refs.summaryCards.innerHTML = `
    <div class="summary-card">Overtime: <strong>${byType["Overtime"]}</strong> entries</div>
    <div class="summary-card">Offsite Execution: <strong>${byType["Offsite Execution"]}</strong> entries</div>
    <div class="summary-card">Offsite Overview: <strong>${byType["Offsite Overview"]}</strong> entries</div>
    <div class="summary-card">Total Hours: <strong>${sumHours(monthly).toFixed(2)}</strong></div>
    <div class="summary-card">Weekly Breakdown:<br/>${weeklyBreakdown(monthly)}</div>
  `;
}

function renderSuggestions() {
  refs.suggestions.innerHTML = "";
  const top = getTopSuggestions();
  if (!top.length) {
    refs.suggestions.innerHTML = '<span class="muted">Suggestions appear after a few entries.</span>';
    return;
  }

  top.forEach((item) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "chip";
    btn.textContent = `${item.client} / ${item.type}`;
    btn.title = `Use ${item.client} - ${item.type}`;
    btn.addEventListener("click", () => {
      refs.clientInput.value = item.client;
      setSelectedType(item.type);
      refs.activityInput.value = item.activityHint || refs.activityInput.value;
      refs.reasonInput.value = item.reasonHint || refs.reasonInput.value;
    });
    refs.suggestions.appendChild(btn);
  });
}

function exportCsv() {
  const month = refs.monthInput.value;
  const rows = state.entries.filter((e) => e.date.startsWith(month));
  const header = ["date", "type", "client", "start", "end", "hours", "activity", "reason", "projectTag"];
  const csv = [
    header.join(","),
    ...rows.map((r) =>
      header
        .map((key) => `"${String(r[key] ?? "").replaceAll('"', '""')}"`)
        .join(",")
    ),
  ].join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  downloadBlob(blob, `worklog-${month}.csv`);
}

function exportPdf() {
  // On iOS this opens the native print dialog; choose Save as PDF.
  window.print();
}

function startTimer() {
  if (state.timerStartTs) return;
  state.timerStartTs = Date.now();
  state.timerInterval = setInterval(updateTimerDisplay, 1000);
  updateTimerDisplay();
}

function stopTimer() {
  if (!state.timerStartTs) return;
  state.timerElapsedMs += Date.now() - state.timerStartTs;
  state.timerStartTs = null;
  clearInterval(state.timerInterval);
  state.timerInterval = null;
  updateTimerDisplay();
}

function applyTimerToHours() {
  const ms = getTimerTotalMs();
  const hrs = ms / 3600000;
  refs.hoursInput.value = (Math.round(hrs * 100) / 100).toString();
}

function getTimerTotalMs() {
  if (!state.timerStartTs) return state.timerElapsedMs;
  return state.timerElapsedMs + (Date.now() - state.timerStartTs);
}

function updateTimerDisplay() {
  const totalSec = Math.floor(getTimerTotalMs() / 1000);
  const h = String(Math.floor(totalSec / 3600)).padStart(2, "0");
  const m = String(Math.floor((totalSec % 3600) / 60)).padStart(2, "0");
  const s = String(totalSec % 60).padStart(2, "0");
  refs.timerDisplay.textContent = `${h}:${m}:${s}`;
}

function weeklyBreakdown(entries) {
  if (!entries.length) return "No data";
  const weekMap = {};
  entries.forEach((e) => {
    const weekId = getWeekOfMonth(new Date(`${e.date}T00:00:00`));
    weekMap[weekId] = (weekMap[weekId] || 0) + (Number(e.hours) || 0);
  });
  return Object.keys(weekMap)
    .sort((a, b) => Number(a) - Number(b))
    .map((w) => `Week ${w}: ${weekMap[w].toFixed(2)} hrs`)
    .join("<br/>");
}

function getTopSuggestions() {
  const map = new Map();
  state.entries.forEach((e) => {
    if (!e.client || !e.type) return;
    const key = `${e.client}__${e.type}`;
    if (!map.has(key)) {
      map.set(key, {
        client: e.client,
        type: e.type,
        count: 0,
        activityHint: e.activity || "",
        reasonHint: e.reason || "",
      });
    }
    const item = map.get(key);
    item.count += 1;
    if (e.activity && !item.activityHint) item.activityHint = e.activity;
    if (e.reason && !item.reasonHint) item.reasonHint = e.reason;
  });
  return Array.from(map.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);
}

function getLearnedSuggestion(text) {
  const lowered = text.toLowerCase();
  const top = getTopSuggestions();
  for (const item of top) {
    if (lowered.includes(item.client.toLowerCase())) return item;
    if (item.activityHint && lowered.includes(item.activityHint.toLowerCase().split(" ")[0])) return item;
  }
  return {};
}

function getWeekOfMonth(date) {
  const first = new Date(date.getFullYear(), date.getMonth(), 1);
  const adjusted = first.getDay() + date.getDate();
  return Math.ceil(adjusted / 7);
}

function loadEntries() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function persistEntries() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.entries));
}

function formatDateISO(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
function formatDateHuman(date) {
  return date.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
}
function setSelectedType(type) {
  state.selectedType = type;
  document.querySelectorAll(".pill").forEach((p) => {
    p.classList.toggle("active", p.dataset.type === type);
  });
}
function calcHours(start, end) {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  let mins = (eh * 60 + em) - (sh * 60 + sm);
  if (mins < 0) mins += 24 * 60;
  return Math.round((mins / 60) * 100) / 100;
}
function toTime(v) {
  return v.replace(".", ":").padStart(5, "0");
}
function cleanClient(value) {
  return value
    .replace(/\b(overtime|execution|overview|reason|because|from|to|hours?|hrs?)\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}
function sumHours(arr) {
  return arr.reduce((acc, e) => acc + (Number(e.hours) || 0), 0);
}
function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
