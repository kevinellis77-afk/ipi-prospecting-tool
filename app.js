const STATUS_OPTIONS = [
  "Unreviewed",
  "Review Complete",
  "Priority Target",
  "Outreach Ready",
  "In Contact",
  "Nurture",
  "Not a Fit"
];

const STORAGE_KEYS = {
  workflow: "ipi_v11_workflow_state",
  views: "ipi_v1_saved_views"
};

const state = {
  partners: [],
  activePartnerName: null,
  activeView: "prospects",
  sort: { key: "weightedScore", dir: "desc" },
  filters: {
    search: "",
    minScore: 0,
    tiers: new Set(),
    vendors: new Set(),
    services: new Set(),
    confidence: new Set(),
    missingTurnoverOnly: false,
    missingLinkedInOnly: false,
    missingNotesOnly: false,
    dataQueueOnly: false,
    priorityOnly: false,
    status: "",
    engagedOnly: false
  },
  qualityFilters: new Set(),
  workflow: loadJSON(STORAGE_KEYS.workflow, {}),
  savedViews: loadJSON(STORAGE_KEYS.views, {})
};

function loadJSON(key, fallback){ try { return JSON.parse(localStorage.getItem(key) || "null") ?? fallback; } catch { return fallback; } }
function persistWorkflow(){ localStorage.setItem(STORAGE_KEYS.workflow, JSON.stringify(state.workflow)); }
function persistSavedViews(){ localStorage.setItem(STORAGE_KEYS.views, JSON.stringify(state.savedViews)); }

function getWorkflow(name){
  const item = state.workflow[name] || {};
  return {
    status: STATUS_OPTIONS.includes(item.status) ? item.status : "Unreviewed",
    priority: !!item.priority,
    owner: item.owner || "",
    notes: item.notes || "",
    lastUpdated: item.lastUpdated || ""
  };
}

function setWorkflow(name, patch){
  state.workflow[name] = { ...getWorkflow(name), ...patch, lastUpdated: new Date().toISOString() };
  persistWorkflow();
}

function statusClass(status){
  return `status-${String(status || "Unreviewed").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
}

function isEngagedStatus(status){
  return ["Review Complete", "Priority Target", "Outreach Ready", "In Contact", "Nurture"].includes(status);
}

function showError(message){
  const el = document.getElementById("appError");
  el.style.display = "block";
  el.textContent = message;
}

function hideError(){ document.getElementById("appError").style.display = "none"; }

function buildCheckGroup(containerId, options, selectedSet){
  const container = document.getElementById(containerId);
  container.innerHTML = options.map(opt => `<label class="check"><input type="checkbox" value="${escapeAttr(opt)}"> ${escapeHtml(opt)}</label>`).join("");
  container.querySelectorAll("input").forEach(input => {
    input.checked = selectedSet.has(input.value);
    input.addEventListener("change", () => {
      input.checked ? selectedSet.add(input.value) : selectedSet.delete(input.value);
      renderAll();
    });
  });
}

function bindFilters(){
  const map = [
    ["globalSearch", "search", e => e.target.value.trim().toLowerCase()],
    ["statusFilter", "status", e => e.target.value],
    ["missingTurnoverOnly", "missingTurnoverOnly", e => e.target.checked],
    ["missingLinkedInOnly", "missingLinkedInOnly", e => e.target.checked],
    ["missingNotesOnly", "missingNotesOnly", e => e.target.checked],
    ["priorityOnly", "priorityOnly", e => e.target.checked]
  ];
  map.forEach(([id, key, fn]) => document.getElementById(id).addEventListener("input", e => { state.filters[key] = fn(e); renderAll(); }));

  document.getElementById("minScore").addEventListener("input", e => {
    const v = Number(e.target.value);
    state.filters.minScore = v;
    document.getElementById("minScoreValue").value = v.toFixed(1);
    renderAll();
  });

  document.getElementById("resetFiltersBtn").addEventListener("click", resetFilters);
  document.getElementById("refreshBtn").addEventListener("click", renderAll);
  document.getElementById("exportBtn").addEventListener("click", exportCurrentView);
  document.getElementById("saveViewBtn").addEventListener("click", saveCurrentView);
  document.getElementById("savedViews").addEventListener("change", e => e.target.value && applySavedView(e.target.value));
  document.getElementById("drawerClose").addEventListener("click", closeDrawer);

  document.querySelectorAll("th[data-sort]").forEach(th => {
    th.addEventListener("click", () => {
      const map = { routeToRevenue: "scoring.routeToRevenue.score", vendor: "scoring.vendor.score" };
      const key = map[th.dataset.sort] || th.dataset.sort;
      if (state.sort.key === key) state.sort.dir = state.sort.dir === "asc" ? "desc" : "asc";
      else { state.sort.key = key; state.sort.dir = key === "name" ? "asc" : "desc"; }
      renderAll();
    });
  });

  document.querySelectorAll(".tab").forEach(btn => {
    btn.addEventListener("click", () => {
      state.activeView = btn.dataset.view;
      document.querySelectorAll(".tab").forEach(t => t.classList.toggle("active", t === btn));
      document.querySelectorAll(".view").forEach(v => v.classList.toggle("active", v.id === `view-${btn.dataset.view}`));
    });
  });
}

async function loadPartners(){
  hideError();
  try {
    const res = await fetch("./partners_v1.json", { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (!Array.isArray(data)) throw new Error("Invalid JSON structure");
    state.partners = data;
    document.getElementById("heroRecordCount").textContent = `${data.length} partner records`;
    buildDynamicFilters();
    populateSavedViews();
    renderAll();
  } catch (err) {
    state.partners = [];
    renderAll();
    showError(`Could not load partner data from partners_v1.json (${err.message}). Check file path and static hosting root.`);
  }
}

function buildDynamicFilters(){
  buildCheckGroup("tierFilters", uniq(state.partners.map(p => p.tier).filter(Boolean)), state.filters.tiers);
  buildCheckGroup("vendorFilters", uniq(state.partners.flatMap(p => p.vendors || []).filter(Boolean)), state.filters.vendors);
  buildCheckGroup("serviceFilters", uniq(state.partners.flatMap(p => p.services || []).filter(Boolean)), state.filters.services);
  buildCheckGroup("confidenceFilters", ["High", "Medium", "Low"], state.filters.confidence);
}

function resetFilters(){
  state.filters.search = ""; state.filters.minScore = 0; state.filters.tiers = new Set();
  state.filters.vendors = new Set(); state.filters.services = new Set(); state.filters.confidence = new Set();
  state.filters.missingTurnoverOnly = false; state.filters.missingLinkedInOnly = false;
  state.filters.missingNotesOnly = false; state.filters.dataQueueOnly = false;
  state.filters.priorityOnly = false; state.filters.status = ""; state.filters.engagedOnly = false;
  document.getElementById("globalSearch").value = "";
  document.getElementById("minScore").value = 0; document.getElementById("minScoreValue").value = "0.0";
  ["missingTurnoverOnly", "missingLinkedInOnly", "missingNotesOnly", "priorityOnly"].forEach(id => document.getElementById(id).checked = false);
  document.getElementById("statusFilter").value = "";
  buildDynamicFilters();
  renderAll();
}

function filterPartners(){
  return state.partners.filter(partner => {
    const w = getWorkflow(partner.name);
    const hay = [partner.name, partner.locationCity, partner.locationState, partner.additionalInfo, ...(partner.vendors||[]), ...(partner.services||[]), ...(partner.industries||[])].join(" ").toLowerCase();
    if (state.filters.search && !hay.includes(state.filters.search)) return false;
    if ((partner.weightedScore || 0) < state.filters.minScore) return false;
    if (state.filters.tiers.size && !state.filters.tiers.has(partner.tier)) return false;
    if (state.filters.vendors.size && !(partner.vendors||[]).some(v => state.filters.vendors.has(v))) return false;
    if (state.filters.services.size && !(partner.services||[]).some(v => state.filters.services.has(v))) return false;
    if (state.filters.confidence.size && !state.filters.confidence.has(partner.confidence)) return false;
    if (state.filters.missingTurnoverOnly && !partner.dataQuality?.missingTurnover) return false;
    if (state.filters.missingLinkedInOnly && !partner.dataQuality?.missingLinkedIn) return false;
    if (state.filters.missingNotesOnly && !partner.dataQuality?.missingNotes) return false;
    if (state.filters.dataQueueOnly && !getDataQualityReasons(partner).length) return false;
    if (state.filters.priorityOnly && !w.priority) return false;
    if (state.filters.status && state.filters.status !== w.status) return false;
    if (state.filters.engagedOnly && !isEngagedStatus(w.status)) return false;
    return true;
  });
}

function sortPartners(items){
  const dir = state.sort.dir === "asc" ? 1 : -1;
  return [...items].sort((a,b) => {
    let va = resolve(state.sort.key, a), vb = resolve(state.sort.key, b);
    if (state.sort.key === "confidence") { va = confRank(a.confidence); vb = confRank(b.confidence); }
    if (state.sort.key === "tier") { va = Number(a.tier?.match(/Tier (\d)/)?.[1] || 9); vb = Number(b.tier?.match(/Tier (\d)/)?.[1] || 9); }
    if (va == null || va === "") va = -99999; if (vb == null || vb === "") vb = -99999;
    return typeof va === "string" || typeof vb === "string" ? String(va).localeCompare(String(vb)) * dir : (va - vb) * dir;
  });
}

function renderTable(items){
  const tbody = document.getElementById("partnerTableBody");
  if (!items.length) { tbody.innerHTML = ""; document.getElementById("emptyState").hidden = false; document.getElementById("tableSummary").textContent = "0 partners"; return; }
  document.getElementById("emptyState").hidden = true;
  tbody.innerHTML = items.map(p => {
    const w = getWorkflow(p.name);
    const c = p.scoring || {};
    const scoreMini = `R${c.routeToRevenue?.score||"-"}/V${c.vendor?.score||"-"}/C${c.customer?.score||"-"}/S${c.sales?.score||"-"}/Sc${c.scale?.score||"-"}/G${c.geo?.score||"-"}`;
    const statusCls = statusClass(w.status);
    return `<tr data-partner="${escapeAttr(p.name)}" class="status-row ${statusCls}">
      <td>${p.rank ?? "—"}</td>
      <td class="name-cell"><div class="name-main">${escapeHtml(p.name)}</div><div class="name-sub">${escapeHtml(p.normalized?.employeeBand || "Unknown")} · ${escapeHtml(p.normalized?.geoBand || "Unknown")}</div></td>
      <td><span class="badge ${tierClass(p.tier)}">${escapeHtml((p.tier || "").replace(" – ", " · "))}</span></td>
      <td class="score-cell"><div class="score-main">${fmt(p.weightedScore)} <span class="chip soft">${scoreMini}</span></div><div class="score-bar"><span style="width:${Math.min(100, ((p.weightedScore||0)/5)*100)}%"></span></div></td>
      <td>${escapeHtml(p.scoring?.routeToRevenue?.label || "—")}</td>
      <td>${escapeHtml(p.scoring?.vendor?.label || "—")}</td>
      <td><div class="chip-row">${(p.services||[]).slice(0,4).map(s=>`<span class="chip">${escapeHtml(s)}</span>`).join("")}</div></td>
      <td>${escapeHtml([p.locationCity,p.locationState].filter(Boolean).join(", ") || "—")}</td>
      <td>${escapeHtml(formatEmployees(p.employees, p.employeesRaw))} / ${escapeHtml(formatTurnover(p.turnoverM))}</td>
      <td><div class="chip-row">${w.priority ? '<span class="chip">Priority</span>' : ''}<span class="chip status-chip ${statusCls}">${escapeHtml(w.status)}</span></div></td>
      <td><span class="badge ${p.confidence==='High'?'tier1':p.confidence==='Medium'?'tier2':'tier4'}">${escapeHtml(p.confidence || 'Low')}</span></td>
    </tr>`;
  }).join("");
  document.querySelectorAll("#partnerTableBody tr").forEach(r => r.addEventListener("click", () => openDrawer(r.dataset.partner)));
  document.getElementById("tableSummary").textContent = `${items.length} partners`;
  document.getElementById("sortSummary").textContent = `Sorted by ${state.sort.key} ${state.sort.dir}`;
}

function getDataQualityReasons(p){
  const w = getWorkflow(p.name);
  const reasons = [];
  if (p.dataQuality?.missingTurnover || p.turnoverM == null || p.turnoverM === "") reasons.push("Missing turnover");
  if (p.dataQuality?.missingLinkedIn || !p.linkedin) reasons.push("Missing LinkedIn");
  if (!p.website) reasons.push("Missing website");
  if (p.dataQuality?.missingNotes || !w.notes.trim()) reasons.push("Missing notes");
  if (!(p.vendors || []).length) reasons.push("Missing vendors");
  if (!(p.services || []).length) reasons.push("Missing services");
  return reasons;
}

function renderQualityView(){
  const queue = state.partners.map(p => ({ p, reasons: getDataQualityReasons(p) })).filter(x => x.reasons.length);
  const options = ["Missing turnover","Missing LinkedIn","Missing website","Missing notes","Missing vendors","Missing services"];
  const qf = document.getElementById("qualityFilters");
  qf.innerHTML = options.map(r => `<label class="check"><input type="checkbox" value="${escapeAttr(r)}" ${state.qualityFilters.has(r)?"checked":""}> ${escapeHtml(r)}</label>`).join("");
  qf.querySelectorAll("input").forEach(i => i.addEventListener("change", () => { i.checked ? state.qualityFilters.add(i.value) : state.qualityFilters.delete(i.value); renderAll(); }));

  const filtered = queue.filter(item => !state.qualityFilters.size || Array.from(state.qualityFilters).every(f => item.reasons.includes(f)));

  document.getElementById("dataQualityCards").innerHTML = [
    ["Missing turnover", queue.filter(x => x.reasons.includes("Missing turnover")).length],
    ["Missing LinkedIn", queue.filter(x => x.reasons.includes("Missing LinkedIn")).length],
    ["Missing notes", queue.filter(x => x.reasons.includes("Missing notes")).length],
    ["Queue count", filtered.length]
  ].map(([title, value]) => `<div class="dq-card"><div class="panel-sub">${title}</div><div class="big">${value}</div></div>`).join("");

  document.getElementById("qualityTableBody").innerHTML = filtered.map(({p,reasons}) => `<tr>
    <td><div class="name-main">${escapeHtml(p.name)}</div><div class="name-sub">${escapeHtml(p.tier||"—")}</div></td>
    <td><div class="chip-row">${reasons.map(r=>`<span class="chip soft">${escapeHtml(r)}</span>`).join("")}</div></td>
    <td><span class="badge ${p.confidence==='High'?'tier1':p.confidence==='Medium'?'tier2':'tier4'}">${escapeHtml(p.confidence || 'Low')}</span></td>
    <td>${p.website ? `<a class="link-pill" href="${escapeAttr(normalizeUrl(p.website))}" target="_blank" rel="noreferrer">Open website</a>` : "—"}</td>
    <td>${escapeHtml(getWorkflow(p.name).notes || p.additionalInfo || "No notes")}</td>
  </tr>`).join("");

  document.querySelector('.tab[data-view="quality"]').textContent = `Data Quality Queue (${filtered.length})`;
}

function suggestedAngles(p){
  const vendors = (p.vendors || []).map(v => String(v).toLowerCase());
  const services = (p.services || []).map(v => String(v).toLowerCase());
  const hasLegacy = vendors.some(v => ["mitel","cisco","avaya"].some(x => v.includes(x)));
  const hasMs = vendors.some(v => v.includes("microsoft"));
  const hasCC = services.some(v => v.includes("cc") || v.includes("contact"));
  const hasUC = services.some(v => v.includes("uc"));
  const hasManaged = services.some(v => v.includes("managed"));
  const hasModernCC = vendors.some(v => ["genesys","nice","talkdesk","five9","zendesk","zoom"].some(x => v.includes(x)));
  if (hasLegacy && hasUC) return "Displacement + CC expansion: legacy voice footprint with UC motion present.";
  if (hasMs && !hasCC) return "Teams-to-CX expansion: Microsoft base is visible but clear CC capability is weak.";
  if (hasManaged && hasUC && !hasCC) return "Platform expansion: managed service + UC foundation can support CX up-sell.";
  if (hasModernCC) return "Qualification warning: modern CCaaS already present, likely lower-priority displacement.";
  return "Qualification-first angle: validate current telephony/CC stack before deep pursuit.";
}

function whyScoreRows(p){
  const weights = { routeToRevenue:0.40, vendor:0.20, customer:0.15, sales:0.15, scale:0.05, geo:0.05 };
  return Object.entries(weights).map(([k,w]) => {
    const s = p.scoring?.[k]?.score || 0;
    const label = ({routeToRevenue:"Route-to-Revenue",vendor:"Vendor",customer:"Customer",sales:"Sales",scale:"Scale",geo:"Geo"})[k];
    return { label, score: s, weight: w, contribution: (s*w).toFixed(2), detail: p.scoring?.[k]?.label || "" };
  });
}

function openDrawer(name){
  const p = state.partners.find(x => x.name === name);
  if (!p) return;
  state.activePartnerName = name;
  const w = getWorkflow(name);
  const rows = whyScoreRows(p);
  document.getElementById("drawer").classList.add("open");
  document.getElementById("drawerHead").innerHTML = `<div><div class="chip-row"><span class="badge ${tierClass(p.tier)}">${escapeHtml(p.tier||"—")}</span><span class="badge ${p.confidence==='High'?'tier1':p.confidence==='Medium'?'tier2':'tier4'}">${escapeHtml(p.confidence || 'Low')} confidence</span></div><h2 class="drawer-title">${escapeHtml(p.name)}</h2></div>
  <div class="drawer-kpis"><div class="drawer-card"><h4>Weighted score</h4><p style="font-size:30px;font-weight:800">${fmt(p.weightedScore)}</p></div><div class="drawer-card"><h4>Status</h4><p><span class="chip status-chip ${statusClass(w.status)}">${escapeHtml(w.status)}</span></p></div></div>`;

  document.getElementById("drawerBody").innerHTML = `
  <div class="drawer-card"><h4>Workflow</h4><div class="form-grid">
    <label>Status<select class="select" id="drawerStatus">${STATUS_OPTIONS.map(s=>`<option ${w.status===s?"selected":""}>${s}</option>`).join("")}</select></label>
    <label class="check"><input type="checkbox" id="drawerPriority" ${w.priority?"checked":""}> Priority target ⭐</label>
    <label>Owner<input class="select" id="drawerOwner" value="${escapeAttr(w.owner)}" placeholder="Account owner"></label>
    <label>Notes<textarea class="textarea" id="drawerNotes" placeholder="Prospecting notes">${escapeHtml(w.notes)}</textarea></label>
    <button class="btn btn-accent" id="saveWorkflowBtn">Save workflow state</button>
    <div class="panel-sub" id="workflowAutosaveMsg">Changes auto-save locally${w.lastUpdated ? ` · Last saved ${new Date(w.lastUpdated).toLocaleString()}` : ""}</div>
  </div></div>

  <div class="drawer-card"><h4>Why this score</h4>
    <div class="score-grid">${rows.map(r => `<div class="score-item"><div class="top"><div class="label">${r.label}</div><span class="badge tier1">${r.score}/5 × ${Math.round(r.weight*100)}%</span></div><div class="small">${escapeHtml(r.detail)} · Contribution ${r.contribution}</div></div>`).join("")}</div>
    <p style="margin-top:10px"><strong>Total weighted:</strong> ${fmt(p.weightedScore)} (stored in source data).</p>
  </div>

  <div class="drawer-card"><h4>Suggested angle</h4><p>${escapeHtml(suggestedAngles(p))}</p></div>`;

  const saveWorkflowFromDrawer = () => {
    setWorkflow(name, {
      status: document.getElementById("drawerStatus").value,
      priority: document.getElementById("drawerPriority").checked,
      owner: document.getElementById("drawerOwner").value.trim(),
      notes: document.getElementById("drawerNotes").value.trim()
    });
    const msg = document.getElementById("workflowAutosaveMsg");
    if (msg) msg.textContent = `Changes auto-save locally · Last saved ${new Date(getWorkflow(name).lastUpdated).toLocaleString()}`;
  };

  document.getElementById("saveWorkflowBtn").addEventListener("click", () => {
    saveWorkflowFromDrawer();
    renderAll();
    openDrawer(name);
  });

  document.getElementById("drawerStatus").addEventListener("input", () => {
    saveWorkflowFromDrawer();
    renderAll();
  });
  document.getElementById("drawerPriority").addEventListener("change", () => {
    saveWorkflowFromDrawer();
    renderAll();
  });
  ["drawerOwner", "drawerNotes"].forEach(id => {
    document.getElementById(id).addEventListener("input", saveWorkflowFromDrawer);
  });
}

function closeDrawer(){ document.getElementById("drawer").classList.remove("open"); }

function renderKPIs(filtered){
  const queueCount = state.partners.filter(p => getDataQualityReasons(p).length).length;
  const kpis = [
    ["Total Partners", filtered.length, "Current filtered result set", "📊", "total"],
    ["Tier 1", filtered.filter(p => (p.tier||"").includes("Tier 1")).length, "Strategic targets in view", "🎯", "tier1"],
    ["Priority", filtered.filter(p => getWorkflow(p.name).priority).length, "Priority flagged accounts", "⭐", "priority"],
    ["Outreach Ready", filtered.filter(p => getWorkflow(p.name).status === "Outreach Ready").length, "Workflow stage", "📬", "outreach"],
    ["Engaged", filtered.filter(p => isEngagedStatus(getWorkflow(p.name).status)).length, "Reviewed or in motion", "🤝", "engaged"],
    ["Data Queue", queueCount, "Records needing cleanup", "🧹", "dataQueue"],
    ["Avg Score", filtered.length ? (filtered.reduce((a,p)=>a+Number(p.weightedScore||0),0)/filtered.length).toFixed(2) : "0.00", "Weighted average score", "⚖️", "avgScore"]
  ];
  document.getElementById("kpiRow").innerHTML = kpis
    .map(k => `<div class="kpi" data-kpi="${k[4]}"><div class="top"><span>${k[0]}</span><span>${k[3]}</span></div><div class="value">${k[1]}</div><div class="meta">${k[2]}</div></div>`)
    .join("");
  document.querySelectorAll("#kpiRow .kpi").forEach(card => {
    card.addEventListener("click", () => applyKpiFilter(card.dataset.kpi));
  });
}

function applyKpiFilter(kpi){
  if (kpi === "avgScore") return;
  state.filters.tiers.clear();
  state.filters.priorityOnly = false;
  state.filters.status = "";
  state.filters.dataQueueOnly = false;
  state.filters.engagedOnly = false;
  document.getElementById("priorityOnly").checked = false;
  document.getElementById("statusFilter").value = "";

  if (kpi === "tier1") {
    state.partners.forEach(partner => {
      if ((partner.tier || "").includes("Tier 1")) state.filters.tiers.add(partner.tier);
    });
    buildDynamicFilters();
  } else if (kpi === "priority") {
    state.filters.priorityOnly = true;
    document.getElementById("priorityOnly").checked = true;
  } else if (kpi === "outreach") {
    state.filters.status = "Outreach Ready";
    document.getElementById("statusFilter").value = "Outreach Ready";
  } else if (kpi === "dataQueue") {
    state.filters.dataQueueOnly = true;
  } else if (kpi === "engaged") {
    state.filters.engagedOnly = true;
  } else if (kpi === "total") {
    buildDynamicFilters();
  }
  renderAll();
}

function renderCurrentViewStats(items){
  document.getElementById("currentViewCount").textContent = items.length;
  document.getElementById("currentViewTier1").textContent = items.filter(p => (p.tier||"").includes("Tier 1")).length;
  document.getElementById("currentViewLegacy").textContent = items.filter(p => (p.scoring?.vendor?.score||0) >= 5).length;
  document.getElementById("currentViewMissing").textContent = items.filter(p => getDataQualityReasons(p).includes("Missing turnover")).length;
}

function renderAll(){
  const filtered = sortPartners(filterPartners());
  renderKPIs(filtered);
  renderTable(filtered);
  renderCurrentViewStats(filtered);
  renderQualityView();
  if (state.activePartnerName && document.getElementById("drawer").classList.contains("open")) openDrawer(state.activePartnerName);
}

function saveCurrentView(){
  const name = prompt("Save current view as");
  if (!name) return;
  state.savedViews[name] = { filters: { ...state.filters, tiers: Array.from(state.filters.tiers), vendors: Array.from(state.filters.vendors), services: Array.from(state.filters.services), confidence: Array.from(state.filters.confidence) }, sort: state.sort };
  persistSavedViews();
  populateSavedViews(name);
}

function applySavedView(name){
  const v = state.savedViews[name]; if (!v) return;
  resetFilters();
  Object.assign(state.filters, { ...v.filters, tiers: new Set(v.filters.tiers||[]), vendors: new Set(v.filters.vendors||[]), services: new Set(v.filters.services||[]), confidence: new Set(v.filters.confidence||[]) });
  state.sort = v.sort || state.sort;
  document.getElementById("globalSearch").value = state.filters.search || "";
  document.getElementById("minScore").value = Number(state.filters.minScore || 0); document.getElementById("minScoreValue").value = Number(state.filters.minScore || 0).toFixed(1);
  ["missingTurnoverOnly","missingLinkedInOnly","missingNotesOnly","priorityOnly"].forEach(id => document.getElementById(id).checked = !!state.filters[id]);
  document.getElementById("statusFilter").value = state.filters.status || "";
  buildDynamicFilters();
  renderAll();
}

function populateSavedViews(selected=""){
  const select = document.getElementById("savedViews");
  const names = Object.keys(state.savedViews).sort((a,b)=>a.localeCompare(b));
  select.innerHTML = `<option value="">Saved views</option>` + names.map(n => `<option value="${escapeAttr(n)}" ${selected===n?"selected":""}>${escapeHtml(n)}</option>`).join("");
}

function exportCurrentView(){
  const rows = sortPartners(filterPartners());
  const headers = ["Name","Tier","Weighted Score","Confidence","Route-to-Revenue","Vendor","Customer","Sales","Scale","Geo","Status","Owner","Priority"];
  const csv = [headers.join(","), ...rows.map(p => {
    const w = getWorkflow(p.name);
    return [p.name, p.tier, p.weightedScore, p.confidence, p.scoring?.routeToRevenue?.score, p.scoring?.vendor?.score, p.scoring?.customer?.score, p.scoring?.sales?.score, p.scoring?.scale?.score, p.scoring?.geo?.score, w.status, w.owner, w.priority ? "Yes" : "No"].map(csvEscape).join(",");
  })].join("\n");
  const date = new Date().toISOString().slice(0,10);
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type:"text/csv;charset=utf-8;" }));
  a.download = `ipi_prospecting_export_${date}.csv`;
  a.click();
}

function csvEscape(v){ return `"${String(v ?? "").replaceAll('"', '""')}"`; }
function resolve(path,obj){ return path.split('.').reduce((acc,k)=>acc && acc[k], obj); }
function uniq(arr){ return [...new Set(arr)].sort((a,b)=>String(a).localeCompare(String(b))); }
function confRank(v){ return ({High:3,Medium:2,Low:1})[v] || 0; }
function fmt(n){ return Number(n||0).toFixed(1); }
function formatTurnover(v){ return (v == null || v === "") ? "Unknown" : `£${Number(v).toFixed(1)}m`; }
function formatEmployees(v,raw){ return v ? `${v}` : (raw ? String(raw) : "Unknown"); }
function normalizeUrl(url){ const s = String(url || "").trim(); if (!s) return ""; return /^https?:\/\//i.test(s) ? s : `https://${s.replace(/^\/+/,"")}`; }
function tierClass(t){ if ((t||"").includes("Tier 1")) return "tier1"; if ((t||"").includes("Tier 2")) return "tier2"; if ((t||"").includes("Tier 3")) return "tier3"; return "tier4"; }
function escapeHtml(s){ return String(s ?? "").replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;'); }
function escapeAttr(s){ return escapeHtml(s).replaceAll("`","&#96;"); }

bindFilters();
loadPartners();
