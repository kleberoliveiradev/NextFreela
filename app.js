const storageKey = "nextfreela-platform-v1";
const env = import.meta.env || {};
const supabaseConfig = {
  url: env.VITE_SUPABASE_URL,
  anonKey: env.VITE_SUPABASE_ANON_KEY
};
let supabase = null;
let currentUser = null;
let cloudAvailable = false;
let syncTimer = null;

const seed = {
  selectedClient: 0,
  projects: [
    { id: 1, name: "Rebrand Vivo", client: "Vivo", due: "2026-06-11", value: 3800, progress: 78, status: "revisao" },
    { id: 2, name: "UI Kit Fintech", client: "Nexa Pay", due: "2026-06-24", value: 5200, progress: 42, status: "ativo" },
    { id: 3, name: "Deck Investidores", client: "Solaris", due: "2026-06-14", value: 2100, progress: 60, status: "aguardando" },
    { id: 4, name: "Campanha Verao", client: "Brisa", due: "2026-06-07", value: 1800, progress: 92, status: "atrasado" }
  ],
  tasks: [
    { id: 1, title: "Revisar paleta de cores do brand", projectId: 1, day: 1, priority: "alta", done: false },
    { id: 2, title: "Desenvolver tela de login", projectId: 2, day: 1, priority: "media", done: false },
    { id: 3, title: "Montar slides da apresentacao", projectId: 3, day: 1, priority: "normal", done: false },
    { id: 4, title: "Exportar assets em SVG", projectId: 4, day: 1, priority: "media", done: true },
    { id: 5, title: "Enviar previa para aprovacao", projectId: 1, day: 2, priority: "alta", done: false },
    { id: 6, title: "Organizar componentes do design system", projectId: 2, day: 3, priority: "normal", done: false },
    { id: 7, title: "Fechar ajustes de copy", projectId: 3, day: 4, priority: "media", done: false }
  ],
  payments: [
    { id: 1, project: "Rebrand Vivo", client: "Vivo", description: "Parcela 1/2", due: "2026-06-05", value: 1900, status: "pago" },
    { id: 2, project: "UI Kit Fintech", client: "Nexa Pay", description: "Sinal de projeto", due: "2026-06-12", value: 2600, status: "pendente" },
    { id: 3, project: "Campanha Verao", client: "Brisa", description: "Pagamento final", due: "2026-06-04", value: 900, status: "atrasado" }
  ],
  messages: [
    { client: "Vivo", project: "Rebrand Vivo", items: [
      { mine: false, text: "Joao, conseguimos revisar a paleta ainda hoje?", time: "09:12" },
      { mine: true, text: "Sim. Envio duas rotas ate 16h para voces compararem.", time: "09:18" }
    ] },
    { client: "Nexa Pay", project: "UI Kit Fintech", items: [
      { mine: false, text: "A tela de login ficou bem alinhada. Podemos seguir para dashboard?", time: "11:04" },
      { mine: true, text: "Perfeito. Vou conectar os estados dos cards e mando o fluxo.", time: "11:16" }
    ] },
    { client: "Solaris", project: "Deck Investidores", items: [
      { mine: false, text: "Inclui os numeros atualizados no documento.", time: "14:05" }
    ] }
  ],
  alerts: [
    "Campanha Verao esta com prazo ultrapassado.",
    "Rebrand Vivo tem entrega em 3 dias.",
    "Nexa Pay tem pagamento pendente para 12/06."
  ]
};

let state = JSON.parse(localStorage.getItem(storageKey) || "null") || structuredClone(seed);
let projectFilter = "todos";
let editingProjectId = null;
let editingTaskId = null;
let editingPaymentId = null;

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));
const money = (value) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const byId = (id) => state.projects.find((project) => project.id === id);
const save = () => {
  localStorage.setItem(storageKey, JSON.stringify(state));
  queueCloudSave();
};

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const isUuid = (value) => typeof value === "string" && uuidPattern.test(value);
const newId = () => crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const todayISO = () => new Date().toISOString().slice(0, 10);
const addDaysISO = (days) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
};

function taskDue(task) {
  if (task.due) return task.due;
  return addDaysISO((task.day || 1) - 1);
}

function taskWeekDay(task) {
  const date = new Date(`${taskDue(task)}T12:00:00`);
  return ((date.getDay() + 6) % 7) + 1;
}

function normalizeLocalState() {
  state.selectedClient = state.selectedClient || 0;
  state.projects = state.projects || [];
  state.tasks = (state.tasks || []).map((task) => ({ ...task, due: taskDue(task), day: taskWeekDay(task) }));
  state.payments = state.payments || [];
  state.messages = state.messages || [];
  state.alerts = state.alerts || [];
}

normalizeLocalState();

function queueCloudSave() {
  if (!supabase || !currentUser) return;
  window.clearTimeout(syncTimer);
  syncTimer = window.setTimeout(() => persistCloudState(), 500);
}

async function initSupabase() {
  if (!supabaseConfig.url || !supabaseConfig.anonKey) return false;
  try {
    const { createClient } = await import("@supabase/supabase-js");
    supabase = createClient(supabaseConfig.url, supabaseConfig.anonKey);
    cloudAvailable = true;
    const { data } = await supabase.auth.getSession();
    currentUser = data.session?.user || null;
    supabase.auth.onAuthStateChange(async (_event, session) => {
      currentUser = session?.user || null;
      if (currentUser) {
        await loadCloudState();
        showAuth("dashboard");
      }
    });
    if (currentUser) await loadCloudState();
    renderAccountState();
    return true;
  } catch (error) {
    console.warn("Supabase indisponivel, usando modo demonstracao.", error);
    renderAccountState();
    return false;
  }
}

async function loadCloudState() {
  if (!supabase || !currentUser) return;
  try {
    await loadRelationalState();
  } catch (error) {
    console.warn("Nao foi possivel carregar dados do Supabase.", error);
  }
}

async function persistCloudState() {
  if (!supabase || !currentUser) return;
  try {
    await persistRelationalState();
  } catch (error) {
    console.warn("Nao foi possivel sincronizar com Supabase.", error);
  }
}

function normalizeCloudIds() {
  const projectMap = new Map();
  state.projects = state.projects.map((project) => {
    const id = isUuid(project.id) ? project.id : newId();
    projectMap.set(project.id, id);
    return { ...project, id };
  });
  state.tasks = state.tasks.map((task) => ({
    ...task,
    id: isUuid(task.id) ? task.id : newId(),
    projectId: projectMap.get(task.projectId) || task.projectId
  }));
  state.payments = state.payments.map((payment) => ({
    ...payment,
    id: isUuid(payment.id) ? payment.id : newId()
  }));
  localStorage.setItem(storageKey, JSON.stringify(state));
}

async function loadRelationalState() {
  const userId = currentUser.id;
  const [projectsRes, tasksRes, paymentsRes, threadsRes, alertsRes] = await Promise.all([
    supabase.from("nextfreela_projects").select("*").eq("user_id", userId).order("created_at", { ascending: true }),
    supabase.from("nextfreela_tasks").select("*").eq("user_id", userId).order("created_at", { ascending: true }),
    supabase.from("nextfreela_payments").select("*").eq("user_id", userId).order("created_at", { ascending: true }),
    supabase.from("nextfreela_threads").select("*, nextfreela_messages(*)").eq("user_id", userId).order("position", { ascending: true }),
    supabase.from("nextfreela_alerts").select("*").eq("user_id", userId).order("created_at", { ascending: true })
  ]);
  const results = [projectsRes, tasksRes, paymentsRes, threadsRes, alertsRes];
  const firstError = results.find((result) => result.error)?.error;
  if (firstError) throw firstError;

  if (!projectsRes.data.length) {
    await persistRelationalState();
    return;
  }

  state = {
    selectedClient: 0,
    projects: projectsRes.data.map((project) => ({
      id: project.id,
      name: project.name,
      client: project.client,
      due: project.due_date,
      value: Number(project.value),
      progress: project.progress,
      status: project.status
    })),
    tasks: tasksRes.data.map((task) => ({
      id: task.id,
      title: task.title,
      projectId: task.project_id,
      due: task.due_date || addDaysISO((task.week_day || 1) - 1),
      day: task.week_day,
      priority: task.priority,
      done: task.done
    })),
    payments: paymentsRes.data.map((payment) => ({
      id: payment.id,
      project: payment.project_name,
      client: payment.client,
      description: payment.description,
      due: payment.due_date,
      value: Number(payment.value),
      status: payment.status
    })),
    messages: threadsRes.data.map((thread) => ({
      id: thread.id,
      client: thread.client,
      project: thread.project,
      items: (thread.nextfreela_messages || [])
        .sort((a, b) => new Date(a.sent_at) - new Date(b.sent_at))
        .map((message) => ({
          id: message.id,
          mine: message.mine,
          text: message.text,
          time: new Date(message.sent_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
        }))
    })),
    alerts: alertsRes.data.map((alert) => alert.text)
  };
  localStorage.setItem(storageKey, JSON.stringify(state));
}

async function persistRelationalState() {
  normalizeCloudIds();
  const userId = currentUser.id;
  await supabase.from("nextfreela_messages").delete().eq("user_id", userId);
  await supabase.from("nextfreela_threads").delete().eq("user_id", userId);
  await supabase.from("nextfreela_alerts").delete().eq("user_id", userId);
  await supabase.from("nextfreela_payments").delete().eq("user_id", userId);
  await supabase.from("nextfreela_tasks").delete().eq("user_id", userId);
  await supabase.from("nextfreela_projects").delete().eq("user_id", userId);

  const projectRows = state.projects.map((project) => ({
    id: project.id,
    user_id: userId,
    name: project.name,
    client: project.client,
    due_date: project.due,
    value: project.value,
    progress: project.progress,
    status: project.status
  }));
  if (projectRows.length) await supabase.from("nextfreela_projects").insert(projectRows).throwOnError();

  const taskRows = state.tasks.map((task) => ({
    id: task.id,
    user_id: userId,
    project_id: isUuid(task.projectId) ? task.projectId : null,
    title: task.title,
    due_date: taskDue(task),
    week_day: taskWeekDay(task),
    priority: task.priority,
    done: task.done
  }));
  if (taskRows.length) await supabase.from("nextfreela_tasks").insert(taskRows).throwOnError();

  const paymentRows = state.payments.map((payment) => ({
    id: payment.id,
    user_id: userId,
    project_name: payment.project,
    client: payment.client,
    description: payment.description,
    due_date: payment.due,
    value: payment.value,
    status: payment.status
  }));
  if (paymentRows.length) await supabase.from("nextfreela_payments").insert(paymentRows).throwOnError();

  const threadRows = state.messages.map((thread, index) => ({
    id: isUuid(thread.id) ? thread.id : newId(),
    user_id: userId,
    client: thread.client,
    project: thread.project,
    position: index
  }));
  state.messages = state.messages.map((thread, index) => ({ ...thread, id: threadRows[index].id }));
  if (threadRows.length) await supabase.from("nextfreela_threads").insert(threadRows).throwOnError();

  const messageRows = state.messages.flatMap((thread) => thread.items.map((message) => ({
    id: isUuid(message.id) ? message.id : newId(),
    user_id: userId,
    thread_id: thread.id,
    mine: message.mine,
    text: message.text,
    sent_at: message.time ? `2026-06-09T${message.time}:00-03:00` : new Date().toISOString()
  })));
  if (messageRows.length) await supabase.from("nextfreela_messages").insert(messageRows).throwOnError();

  const alertRows = state.alerts.map((alert) => ({ user_id: userId, text: alert }));
  if (alertRows.length) await supabase.from("nextfreela_alerts").insert(alertRows).throwOnError();
}

function statusLabel(status) {
  return { ativo: "Ativo", revisao: "Revisao", atrasado: "Atrasado", aguardando: "Aguardando", concluido: "Concluido", pago: "Pago", pendente: "Pendente" }[status] || status;
}

function statusClass(status) {
  return { ativo: "active", revisao: "review", atrasado: "late", aguardando: "wait", concluido: "done", pago: "active", pendente: "review" }[status] || "done";
}

function setView(view) {
  $$(".view").forEach((node) => node.classList.toggle("active", node.id === view));
  $$(".nav-item").forEach((node) => node.classList.toggle("active", node.dataset.view === view));
  const titles = {
    dashboard: "Bom dia, Joao!",
    projetos: "Projetos",
    agenda: "Agenda semanal",
    financeiro: "Financeiro",
    clientes: "Clientes",
    alertas: "Alertas",
    configuracoes: "Configuracoes"
  };
  $("#view-title").textContent = titles[view] || "NextFreela";
}

function showAuth(panel) {
  if (panel === "dashboard") {
    $("#auth").classList.add("hidden");
    $("#app").classList.remove("hidden");
    render();
    return;
  }
  $("#auth").classList.remove("hidden");
  $("#app").classList.add("hidden");
  ["login", "onboarding", "recover"].forEach((name) => {
    $(`#${name}-panel`).classList.toggle("hidden", name !== panel);
  });
}

function renderAccountState() {
  const email = currentUser?.email;
  const isCloud = Boolean(supabase && currentUser);
  $("#profile-name").textContent = email ? email.split("@")[0] : "Joao R.";
  $("#profile-mode").textContent = isCloud ? "Conta sincronizada" : cloudAvailable ? "Supabase pronto" : "Modo demonstracao";
  $("#sync-pill").textContent = isCloud ? "Sincronizado" : cloudAvailable ? "Aguardando login" : "Demo local";
  $("#sync-pill").className = `sync-pill ${isCloud ? "cloud" : "demo"}`;
  $("#logout-button").classList.toggle("hidden", !isCloud);
}

function setNotice(message, type = "info") {
  const notice = $("#login-notice");
  notice.textContent = message;
  notice.classList.remove("hidden");
  notice.style.background = type === "error" ? "#fee2e2" : "#dcfce7";
  notice.style.color = type === "error" ? "#b91c1c" : "#15803d";
}

async function loginWithEmail() {
  if (!supabase) {
    showAuth("dashboard");
    return;
  }
  const email = $("#login-panel input[type='email']").value.trim();
  const password = $("#login-panel input[type='password']").value;
  let result = await supabase.auth.signInWithPassword({ email, password });
  if (result.error && result.error.message.toLowerCase().includes("invalid")) {
    result = await supabase.auth.signUp({ email, password });
    if (!result.error) setNotice("Conta criada. Confira seu email caso a confirmacao esteja ativa.");
  }
  if (result.error) {
    setNotice(result.error.message, "error");
    return;
  }
  if (!result.data.session) {
    setNotice("Conta criada. Confirme seu email para entrar no NextFreela.");
    return;
  }
  currentUser = result.data.user;
  await loadCloudState();
  renderAccountState();
  showAuth("dashboard");
}

async function loginWithGoogle() {
  if (!supabase) {
    showAuth("dashboard");
    return;
  }
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: window.location.origin }
  });
  if (error) setNotice(error.message, "error");
}

async function logout() {
  if (supabase) await supabase.auth.signOut();
  currentUser = null;
  renderAccountState();
  showAuth("login");
}

async function sendRecoveryEmail() {
  if (!supabase) {
    $("#recovery-notice").classList.remove("hidden");
    return;
  }
  const email = $("#recover-panel input").value.trim();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin
  });
  const notice = $("#recovery-notice");
  notice.textContent = error ? error.message : "Link enviado. Verifique sua caixa de entrada.";
  notice.style.background = error ? "#fee2e2" : "#dcfce7";
  notice.style.color = error ? "#b91c1c" : "#15803d";
  notice.classList.remove("hidden");
}

function renderMetrics() {
  const activeProjects = state.projects.filter((project) => project.status !== "concluido").length;
  const dueSoon = state.projects.filter((project) => ["atrasado", "revisao"].includes(project.status)).length;
  const openTasks = state.tasks.filter((task) => !task.done).length;
  const pending = state.payments.filter((payment) => payment.status !== "pago").reduce((sum, payment) => sum + payment.value, 0);
  const totalProjectValue = state.projects.reduce((sum, project) => sum + project.value, 0);
  $("#metrics").innerHTML = [
    ["Projetos ativos", activeProjects, `${dueSoon} exigem atencao`],
    ["Tarefas abertas", openTasks, "na semana atual"],
    ["Receita prevista", money(state.payments.reduce((sum, payment) => sum + payment.value, 0)), "este mes"],
    ["A receber", money(pending), "pendentes ou atrasados"]
  ].map(([label, value, sub]) => `<div class="metric"><span>${label}</span><strong>${value}</strong><small>${sub}</small></div>`).join("");

  const paid = state.payments.filter((payment) => payment.status === "pago").reduce((sum, payment) => sum + payment.value, 0);
  $("#month-paid").textContent = money(paid);
  $("#month-pending").textContent = `${money(pending)} pendentes`;
  $("#finance-metrics").innerHTML = [
    ["Recebido", money(paid), "confirmado"],
    ["Pendente", money(state.payments.filter((p) => p.status === "pendente").reduce((s, p) => s + p.value, 0)), "a vencer"],
    ["Atrasado", money(state.payments.filter((p) => p.status === "atrasado").reduce((s, p) => s + p.value, 0)), "cobrar cliente"],
    ["Ticket medio", money(state.projects.length ? Math.round(totalProjectValue / state.projects.length) : 0), "por projeto"]
  ].map(([label, value, sub]) => `<div class="metric"><span>${label}</span><strong>${value}</strong><small>${sub}</small></div>`).join("");
}

function taskTemplate(task) {
  const project = byId(task.projectId);
  return `<div class="task-row ${task.done ? "done" : ""}" data-task="${task.id}">
    <span class="task-check">✓</span>
    <span class="task-main"><span class="task-title">${task.title}</span><span class="task-sub">${project?.name || "Sem projeto"} · prazo ${formatShort(taskDue(task))}</span></span>
    <span class="status-badge ${task.priority === "alta" ? "late" : task.priority === "media" ? "review" : "wait"}">${task.priority}</span>
    <span class="row-actions">
      <button class="mini-button primary" data-action="toggle-task" data-task="${task.id}">${task.done ? "Reabrir" : "Concluir"}</button>
      <button class="mini-button" data-action="edit-task" data-task="${task.id}">Editar</button>
      <button class="mini-button danger" data-action="delete-task" data-task="${task.id}">Excluir</button>
    </span>
  </div>`;
}

function projectTemplate(project) {
  return `<div class="project-row ${project.status}">
    <div class="row-main"><div class="row-title">${project.name}</div><div class="row-sub">${project.client} · prazo ${formatShort(project.due)}</div></div>
    <span class="status-badge ${statusClass(project.status)}">${statusLabel(project.status)}</span>
    <div class="progress"><span style="width:${project.progress}%"></span></div>
    <div class="row-value">${money(project.value)}</div>
    <span class="row-actions">
      <button class="mini-button" data-action="edit-project" data-project="${project.id}">Editar</button>
      <button class="mini-button danger" data-action="delete-project" data-project="${project.id}">Excluir</button>
    </span>
  </div>`;
}

function paymentTemplate(payment) {
  return `<div class="payment-row ${payment.status}">
    <div class="row-main"><div class="row-title">${payment.project}</div><div class="row-sub">${payment.client} · ${payment.description}</div></div>
    <span class="status-badge ${statusClass(payment.status)}">${statusLabel(payment.status)}</span>
    <div class="row-sub">${formatShort(payment.due)}</div>
    <div class="row-value">${money(payment.value)}</div>
    <span class="row-actions">
      <button class="mini-button primary" data-action="mark-payment-paid" data-payment="${payment.id}">Pago</button>
      <button class="mini-button" data-action="edit-payment" data-payment="${payment.id}">Editar</button>
      <button class="mini-button danger" data-action="delete-payment" data-payment="${payment.id}">Excluir</button>
    </span>
  </div>`;
}

function renderDashboard() {
  const today = todayISO();
  $("#today-tasks").innerHTML = state.tasks.filter((task) => taskDue(task) <= today && !task.done).map(taskTemplate).join("") || `<p class="row-sub">Nenhuma tarefa vencendo hoje.</p>`;
  $("#project-preview").innerHTML = state.projects.slice(0, 4).map(projectTemplate).join("");
  $("#payment-preview").innerHTML = state.payments.slice(0, 3).map(paymentTemplate).join("");
}

function renderProjects() {
  const projects = projectFilter === "todos" ? state.projects : state.projects.filter((project) => project.status === projectFilter);
  $("#project-list").innerHTML = projects.map(projectTemplate).join("") || `<p class="row-sub">Nenhum projeto nesse filtro.</p>`;
}

function renderAgenda() {
  const start = new Date();
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  const labels = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sab", "Dom"];
  $("#week-grid").innerHTML = labels.map((label, index) => {
    const dateObj = new Date(start);
    dateObj.setDate(start.getDate() + index);
    const dateIso = dateObj.toISOString().slice(0, 10);
    const tasks = state.tasks.filter((task) => taskDue(task) === dateIso);
    return `<div class="day-column ${dateIso === todayISO() ? "today" : ""}">
      <div class="day-head"><strong>${label}</strong><span>${dateObj.getDate().toString().padStart(2, "0")}</span></div>
      ${tasks.map((task) => `<div class="day-task ${task.priority}"><strong>${task.title}</strong><span>${byId(task.projectId)?.name || ""}</span></div>`).join("")}
    </div>`;
  }).join("");
}

function renderFinance() {
  $("#payment-list").innerHTML = state.payments.map(paymentTemplate).join("");
}

function renderChat() {
  if (!state.messages.length) {
    $("#client-list").innerHTML = `<p class="row-sub">Nenhum cliente ainda.</p>`;
    $("#chat-client").textContent = "Cliente";
    $("#chat-project").textContent = "Crie um projeto para iniciar um atendimento";
    $("#chat-messages").innerHTML = "";
    return;
  }
  $("#client-list").innerHTML = state.messages.map((thread, index) => `<button class="client-row ${index === state.selectedClient ? "active" : ""}" data-client="${index}">
    <span class="avatar">${thread.client.slice(0, 2).toUpperCase()}</span>
    <span class="row-main"><span class="row-title">${thread.client}</span><span class="row-sub">${thread.project}</span></span>
  </button>`).join("");
  const thread = state.messages[state.selectedClient];
  $("#chat-client").textContent = thread.client;
  $("#chat-project").textContent = thread.project;
  $("#chat-messages").innerHTML = thread.items.map((message) => `<div class="message ${message.mine ? "mine" : ""}"><div class="bubble">${message.text}</div><small>${message.time}</small></div>`).join("");
  $("#chat-messages").scrollTop = $("#chat-messages").scrollHeight;
}

function renderAlerts() {
  $("#alert-count").textContent = state.alerts.length;
  const generated = buildSmartAlerts();
  const alerts = [...generated, ...state.alerts];
  $("#alert-count").textContent = alerts.length;
  $("#alerts-list").innerHTML = alerts.map((alert) => `<div class="alert-row"><span class="row-main"><span class="row-title">${alert}</span><span class="row-sub">Atualizado agora</span></span></div>`).join("") || `<p class="row-sub">Sem alertas no momento.</p>`;
}

function buildSmartAlerts() {
  const today = todayISO();
  const alerts = [];
  state.projects.forEach((project) => {
    if (project.status !== "concluido" && project.due < today) alerts.push(`${project.name} esta com prazo ultrapassado.`);
  });
  state.tasks.forEach((task) => {
    if (!task.done && taskDue(task) < today) alerts.push(`Tarefa atrasada: ${task.title}.`);
  });
  state.payments.forEach((payment) => {
    if (payment.status !== "pago" && payment.due < today) alerts.push(`Pagamento atrasado: ${payment.project} (${money(payment.value)}).`);
  });
  return alerts;
}

function renderTaskOptions() {
  const options = state.projects.map((project) => `<option value="${project.id}">${project.name}</option>`).join("");
  $("#task-project").innerHTML = options || `<option value="">Sem projeto</option>`;
  $("#payment-project").innerHTML = options || `<option value="">Sem projeto</option>`;
}

function render() {
  renderAccountState();
  renderMetrics();
  renderDashboard();
  renderProjects();
  renderAgenda();
  renderFinance();
  renderChat();
  renderAlerts();
  renderTaskOptions();
}

function formatShort(value) {
  if (!value) return "--/--";
  const [year, month, day] = value.split("-");
  return `${day}/${month}`;
}

function openProjectDialog(project = null) {
  editingProjectId = project?.id || null;
  $("#project-dialog h3").textContent = project ? "Editar projeto" : "Novo projeto";
  $("#project-name").value = project?.name || "Landing page campanha";
  $("#project-client").value = project?.client || "Cliente novo";
  $("#project-due").value = project?.due || addDaysISO(14);
  $("#project-value").value = project?.value || 2800;
  $("#project-status").value = project?.status || "ativo";
  $("#project-progress").value = project?.progress ?? 8;
  $("#save-project").textContent = project ? "Salvar projeto" : "Criar projeto";
  $("#project-dialog").showModal();
}

function openTaskDialog(task = null) {
  editingTaskId = task?.id || null;
  $("#task-dialog h3").textContent = task ? "Editar tarefa" : "Nova tarefa";
  $("#task-name").value = task?.title || "Enviar previa para cliente";
  $("#task-project").value = task?.projectId || state.projects[0]?.id || "";
  $("#task-due").value = task ? taskDue(task) : todayISO();
  $("#task-priority").value = task?.priority || "media";
  $("#save-task").textContent = task ? "Salvar tarefa" : "Salvar";
  $("#task-dialog").showModal();
}

function openPaymentDialog(payment = null) {
  editingPaymentId = payment?.id || null;
  $("#payment-dialog h3").textContent = payment ? "Editar pagamento" : "Novo pagamento";
  const project = state.projects.find((item) => item.name === payment?.project) || state.projects[0];
  $("#payment-project").value = project?.id || "";
  $("#payment-description").value = payment?.description || "Parcela 1/2";
  $("#payment-due").value = payment?.due || addDaysISO(7);
  $("#payment-value").value = payment?.value || 1200;
  $("#payment-status").value = payment?.status || "pendente";
  $("#save-payment").textContent = payment ? "Salvar pagamento" : "Salvar pagamento";
  $("#payment-dialog").showModal();
}

function deleteProject(projectId) {
  if (!window.confirm("Excluir este projeto e suas tarefas vinculadas?")) return;
  const project = byId(projectId);
  state.projects = state.projects.filter((item) => item.id !== projectId);
  state.tasks = state.tasks.filter((task) => task.projectId !== projectId);
  state.payments = state.payments.filter((payment) => payment.project !== project?.name);
  save();
  render();
}

function deleteTask(taskId) {
  if (!window.confirm("Excluir esta tarefa?")) return;
  state.tasks = state.tasks.filter((task) => task.id !== taskId);
  save();
  render();
}

function deletePayment(paymentId) {
  if (!window.confirm("Excluir este pagamento?")) return;
  state.payments = state.payments.filter((payment) => payment.id !== paymentId);
  save();
  render();
}

function bindEvents() {
  document.addEventListener("click", (event) => {
    const actionButton = event.target.closest("[data-action]");
    if (actionButton) {
      event.preventDefault();
      event.stopPropagation();
      const action = actionButton.dataset.action;
      if (action === "toggle-task") {
        const task = state.tasks.find((item) => item.id === actionButton.dataset.task);
        if (task) task.done = !task.done;
      }
      if (action === "edit-task") {
        openTaskDialog(state.tasks.find((item) => item.id === actionButton.dataset.task));
        return;
      }
      if (action === "delete-task") deleteTask(actionButton.dataset.task);
      if (action === "edit-project") {
        openProjectDialog(state.projects.find((item) => item.id === actionButton.dataset.project));
        return;
      }
      if (action === "delete-project") deleteProject(actionButton.dataset.project);
      if (action === "mark-payment-paid") {
        const payment = state.payments.find((item) => item.id === actionButton.dataset.payment);
        if (payment) payment.status = "pago";
      }
      if (action === "edit-payment") {
        openPaymentDialog(state.payments.find((item) => item.id === actionButton.dataset.payment));
        return;
      }
      if (action === "delete-payment") deletePayment(actionButton.dataset.payment);
      save();
      render();
      return;
    }

    const viewButton = event.target.closest("[data-view]");
    if (viewButton) setView(viewButton.dataset.view);

    const authButton = event.target.closest("[data-auth]");
    if (authButton) showAuth(authButton.dataset.auth);

    const client = event.target.closest("[data-client]");
    if (client) {
      state.selectedClient = Number(client.dataset.client);
      save();
      renderChat();
    }
  });

  $("#quick-add").addEventListener("click", () => openTaskDialog());
  $("#email-login").addEventListener("click", loginWithEmail);
  $("#google-login").addEventListener("click", loginWithGoogle);
  $("#logout-button").addEventListener("click", logout);
  $("#add-project").addEventListener("click", () => openProjectDialog());
  $("#add-payment").addEventListener("click", () => {
    openPaymentDialog();
  });
  $("#save-task").addEventListener("click", () => {
    const payload = {
      id: editingTaskId || newId(),
      title: $("#task-name").value,
      projectId: $("#task-project").value,
      due: $("#task-due").value,
      day: taskWeekDay({ due: $("#task-due").value }),
      priority: $("#task-priority").value,
      done: editingTaskId ? state.tasks.find((task) => task.id === editingTaskId)?.done || false : false
    };
    if (editingTaskId) {
      state.tasks = state.tasks.map((task) => task.id === editingTaskId ? payload : task);
    } else {
      state.tasks.push(payload);
    }
    editingTaskId = null;
    save();
    render();
  });
  $("#save-project").addEventListener("click", () => {
    const payload = {
      id: editingProjectId || newId(),
      name: $("#project-name").value,
      client: $("#project-client").value,
      due: $("#project-due").value,
      value: Number($("#project-value").value),
      progress: Math.min(100, Math.max(0, Number($("#project-progress").value))),
      status: $("#project-status").value
    };
    if (editingProjectId) {
      state.projects = state.projects.map((project) => project.id === editingProjectId ? payload : project);
    } else {
      state.projects.unshift(payload);
      state.messages.unshift({ id: newId(), client: payload.client, project: payload.name, items: [] });
    }
    editingProjectId = null;
    save();
    render();
  });
  $("#save-payment").addEventListener("click", () => {
    const project = byId($("#payment-project").value) || state.projects[0] || { name: "Sem projeto", client: "Cliente" };
    const payload = {
      id: editingPaymentId || newId(),
      project: project.name,
      client: project.client,
      description: $("#payment-description").value,
      due: $("#payment-due").value,
      value: Number($("#payment-value").value),
      status: $("#payment-status").value
    };
    if (editingPaymentId) {
      state.payments = state.payments.map((payment) => payment.id === editingPaymentId ? payload : payment);
    } else {
      state.payments.unshift(payload);
    }
    editingPaymentId = null;
    save();
    render();
  });
  $("#project-tabs").addEventListener("click", (event) => {
    const tab = event.target.closest("[data-filter]");
    if (!tab) return;
    projectFilter = tab.dataset.filter;
    $$("#project-tabs button").forEach((button) => button.classList.toggle("active", button === tab));
    renderProjects();
  });
  $("#chat-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const input = $("#chat-input");
    const text = input.value.trim();
    if (!text) return;
    const now = new Date();
    state.messages[state.selectedClient].items.push({ mine: true, text, time: now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) });
    input.value = "";
    save();
    renderChat();
  });
  $("#clear-alerts").addEventListener("click", () => {
    state.alerts = [];
    save();
    renderAlerts();
  });
  $("#send-recovery").addEventListener("click", sendRecoveryEmail);
  $("#create-first-project").addEventListener("click", () => {
    state.projects.unshift({
      id: Date.now(),
      name: $("#first-project-name").value,
      client: $("#first-project-client").value,
      value: Number($("#first-project-value").value),
      due: $("#first-project-date").value,
      progress: 0,
      status: "ativo"
    });
    save();
    showAuth("dashboard");
  });
  $("#compact-mode").addEventListener("change", (event) => document.body.classList.toggle("compact", event.target.checked));
  $("#dark-mode").addEventListener("change", (event) => document.body.classList.toggle("dark", event.target.checked));
}

bindEvents();
initSupabase().then(() => {
  if (currentUser) showAuth("dashboard");
  render();
});
