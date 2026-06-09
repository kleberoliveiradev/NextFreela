const storageKey = "nextfreela-platform-v1";
const env = import.meta.env || {};
const supabaseConfig = {
  url: env.VITE_SUPABASE_URL,
  anonKey: env.VITE_SUPABASE_ANON_KEY
};
let supabase = null;
let currentUser = null;
let cloudAvailable = false;

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

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));
const money = (value) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const byId = (id) => state.projects.find((project) => project.id === id);
const save = () => {
  localStorage.setItem(storageKey, JSON.stringify(state));
  persistCloudState();
};

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
  const { data, error } = await supabase
    .from("nextfreela_states")
    .select("data")
    .eq("user_id", currentUser.id)
    .maybeSingle();
  if (error) {
    console.warn("Nao foi possivel carregar dados do Supabase.", error);
    return;
  }
  if (data?.data) {
    state = data.data;
    localStorage.setItem(storageKey, JSON.stringify(state));
  } else {
    await persistCloudState();
  }
}

async function persistCloudState() {
  if (!supabase || !currentUser) return;
  const { error } = await supabase
    .from("nextfreela_states")
    .upsert({
      user_id: currentUser.id,
      data: state,
      updated_at: new Date().toISOString()
    });
  if (error) console.warn("Nao foi possivel sincronizar com Supabase.", error);
}

function statusLabel(status) {
  return { ativo: "Ativo", revisao: "Revisao", atrasado: "Atrasado", aguardando: "Aguardando", pago: "Pago", pendente: "Pendente" }[status] || status;
}

function statusClass(status) {
  return { ativo: "active", revisao: "review", atrasado: "late", aguardando: "wait", pago: "active", pendente: "review" }[status] || "done";
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

function renderMetrics() {
  const activeProjects = state.projects.filter((project) => project.status !== "concluido").length;
  const dueSoon = state.projects.filter((project) => ["atrasado", "revisao"].includes(project.status)).length;
  const openTasks = state.tasks.filter((task) => !task.done).length;
  const pending = state.payments.filter((payment) => payment.status !== "pago").reduce((sum, payment) => sum + payment.value, 0);
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
    ["Ticket medio", money(Math.round(state.projects.reduce((s, p) => s + p.value, 0) / state.projects.length)), "por projeto"]
  ].map(([label, value, sub]) => `<div class="metric"><span>${label}</span><strong>${value}</strong><small>${sub}</small></div>`).join("");
}

function taskTemplate(task) {
  const project = byId(task.projectId);
  return `<button class="task-row ${task.done ? "done" : ""}" data-task="${task.id}">
    <span class="task-check">✓</span>
    <span class="task-main"><span class="task-title">${task.title}</span><span class="task-sub">${project?.name || "Sem projeto"}</span></span>
    <span class="status-badge ${task.priority === "alta" ? "late" : task.priority === "media" ? "review" : "wait"}">${task.priority}</span>
  </button>`;
}

function projectTemplate(project) {
  return `<div class="project-row ${project.status}">
    <div class="row-main"><div class="row-title">${project.name}</div><div class="row-sub">${project.client} · prazo ${formatShort(project.due)}</div></div>
    <span class="status-badge ${statusClass(project.status)}">${statusLabel(project.status)}</span>
    <div class="progress"><span style="width:${project.progress}%"></span></div>
    <div class="row-value">${money(project.value)}</div>
  </div>`;
}

function paymentTemplate(payment) {
  return `<div class="payment-row ${payment.status}">
    <div class="row-main"><div class="row-title">${payment.project}</div><div class="row-sub">${payment.client} · ${payment.description}</div></div>
    <span class="status-badge ${statusClass(payment.status)}">${statusLabel(payment.status)}</span>
    <div class="row-sub">${formatShort(payment.due)}</div>
    <div class="row-value">${money(payment.value)}</div>
  </div>`;
}

function renderDashboard() {
  $("#today-tasks").innerHTML = state.tasks.filter((task) => task.day === 1).map(taskTemplate).join("");
  $("#project-preview").innerHTML = state.projects.slice(0, 4).map(projectTemplate).join("");
  $("#payment-preview").innerHTML = state.payments.slice(0, 3).map(paymentTemplate).join("");
}

function renderProjects() {
  const projects = projectFilter === "todos" ? state.projects : state.projects.filter((project) => project.status === projectFilter);
  $("#project-list").innerHTML = projects.map(projectTemplate).join("") || `<p class="row-sub">Nenhum projeto nesse filtro.</p>`;
}

function renderAgenda() {
  const days = [
    ["Seg", "08"], ["Ter", "09"], ["Qua", "10"], ["Qui", "11"], ["Sex", "12"], ["Sab", "13"], ["Dom", "14"]
  ];
  $("#week-grid").innerHTML = days.map(([label, date], index) => {
    const tasks = state.tasks.filter((task) => task.day === index + 1);
    return `<div class="day-column ${index === 0 ? "today" : ""}">
      <div class="day-head"><strong>${label}</strong><span>${date}</span></div>
      ${tasks.map((task) => `<div class="day-task ${task.priority}"><strong>${task.title}</strong><span>${byId(task.projectId)?.name || ""}</span></div>`).join("")}
    </div>`;
  }).join("");
}

function renderFinance() {
  $("#payment-list").innerHTML = state.payments.map(paymentTemplate).join("");
}

function renderChat() {
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
  $("#alerts-list").innerHTML = state.alerts.map((alert) => `<div class="alert-row"><span class="row-main"><span class="row-title">${alert}</span><span class="row-sub">Atualizado agora</span></span></div>`).join("") || `<p class="row-sub">Sem alertas no momento.</p>`;
}

function renderTaskOptions() {
  $("#task-project").innerHTML = state.projects.map((project) => `<option value="${project.id}">${project.name}</option>`).join("");
  $("#task-day").innerHTML = ["Segunda", "Terca", "Quarta", "Quinta", "Sexta", "Sabado", "Domingo"].map((day, index) => `<option value="${index + 1}">${day}</option>`).join("");
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
  const [year, month, day] = value.split("-");
  return `${day}/${month}`;
}

function bindEvents() {
  document.addEventListener("click", (event) => {
    const viewButton = event.target.closest("[data-view]");
    if (viewButton) setView(viewButton.dataset.view);

    const authButton = event.target.closest("[data-auth]");
    if (authButton) showAuth(authButton.dataset.auth);

    const taskRow = event.target.closest("[data-task]");
    if (taskRow) {
      const task = state.tasks.find((item) => item.id === Number(taskRow.dataset.task));
      task.done = !task.done;
      save();
      render();
    }

    const client = event.target.closest("[data-client]");
    if (client) {
      state.selectedClient = Number(client.dataset.client);
      save();
      renderChat();
    }
  });

  $("#quick-add").addEventListener("click", () => $("#task-dialog").showModal());
  $("#email-login").addEventListener("click", loginWithEmail);
  $("#google-login").addEventListener("click", loginWithGoogle);
  $("#logout-button").addEventListener("click", logout);
  $("#add-project").addEventListener("click", () => $("#project-dialog").showModal());
  $("#add-payment").addEventListener("click", () => {
    const first = state.projects[0];
    state.payments.unshift({ id: Date.now(), project: first.name, client: first.client, description: "Novo lancamento", due: "2026-06-15", value: 1200, status: "pendente" });
    save();
    render();
  });
  $("#save-task").addEventListener("click", () => {
    state.tasks.push({
      id: Date.now(),
      title: $("#task-name").value,
      projectId: Number($("#task-project").value),
      day: Number($("#task-day").value),
      priority: $("#task-priority").value,
      done: false
    });
    save();
    render();
  });
  $("#save-project").addEventListener("click", () => {
    state.projects.unshift({
      id: Date.now(),
      name: $("#project-name").value,
      client: $("#project-client").value,
      due: $("#project-due").value,
      value: Number($("#project-value").value),
      progress: 8,
      status: $("#project-status").value
    });
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
  $("#send-recovery").addEventListener("click", () => $("#recovery-notice").classList.remove("hidden"));
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
