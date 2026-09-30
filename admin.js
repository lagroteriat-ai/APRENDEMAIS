const tokenInput = document.getElementById('tokenInput');
const loginButton = document.getElementById('loginButton');
const loginMessage = document.getElementById('loginMessage');
const loginBox = document.getElementById('loginBox');
const dashboard = document.getElementById('dashboard');
const leadsBody = document.getElementById('leadsBody');
const tableMessage = document.getElementById('tableMessage');
const searchInput = document.getElementById('searchInput');
let token = sessionStorage.getItem('aprende_admin_token') || '';
let currentLeads = [];

function esc(value) {
  return String(value ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
}

async function loadLeads() {
  tableMessage.textContent = 'Carregando...';
  const q = encodeURIComponent(searchInput.value.trim());
  const response = await fetch(`/api/admin/leads?q=${q}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = await response.json();
  if (!response.ok || !data.ok) {
    tableMessage.textContent = data.message || 'Não foi possível carregar os leads.';
    if (response.status === 401) logout();
    return;
  }

  currentLeads = data.leads || [];
  document.getElementById('totalStat').textContent = data.stats.total || 0;
  document.getElementById('todayStat').textContent = data.stats.hoje || 0;
  document.getElementById('accessStat').textContent = data.stats.acessaram || 0;

  leadsBody.innerHTML = currentLeads.length ? currentLeads.map(lead => `
    <tr>
      <td><strong>${esc(lead.nome)} ${esc(lead.sobrenome)}</strong></td>
      <td>${esc(lead.telefone)}</td>
      <td>${esc(lead.email)}</td>
      <td>${esc(lead.perfil)}</td>
      <td>${formatDate(lead.data_cadastro)}</td>
      <td><span class="status ${lead.acessou_prototipo ? '' : 'no'}">${lead.acessou_prototipo ? 'Acessou' : 'Ainda não'}</span></td>
      <td><button class="delete" data-id="${lead.id}">Excluir</button></td>
    </tr>`).join('') : '<tr><td colspan="7">Nenhum lead encontrado.</td></tr>';
  tableMessage.textContent = '';

  document.querySelectorAll('.delete').forEach(btn => btn.addEventListener('click', () => removeLead(btn.dataset.id)));
}

function formatDate(value) {
  if (!value) return '-';
  const date = new Date(value.replace(' ', 'T') + 'Z');
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('pt-BR');
}

async function removeLead(id) {
  if (!confirm('Excluir este lead? Essa ação não pode ser desfeita.')) return;
  const response = await fetch('/api/admin/leads', {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ id })
  });
  const data = await response.json();
  if (!response.ok || !data.ok) {
    alert(data.message || 'Erro ao excluir.');
    return;
  }
  loadLeads();
}

function login() {
  const value = tokenInput.value.trim();
  if (!value) return;
  token = value;
  sessionStorage.setItem('aprende_admin_token', token);
  showDashboard();
}

function showDashboard() {
  loginBox.hidden = true;
  dashboard.hidden = false;
  loadLeads();
}

function logout() {
  token = '';
  sessionStorage.removeItem('aprende_admin_token');
  dashboard.hidden = true;
  loginBox.hidden = false;
  tokenInput.value = '';
}

function exportCsv() {
  if (!currentLeads.length) return alert('Não há leads para exportar.');
  const headers = ['ID','Nome','Sobrenome','E-mail','Telefone','Perfil','Data cadastro','Acessou protótipo','Data acesso protótipo'];
  const rows = currentLeads.map(l => [l.id,l.nome,l.sobrenome,l.email,l.telefone,l.perfil,l.data_cadastro,l.acessou_prototipo ? 'Sim':'Não',l.data_acesso_prototipo || '']);
  const csv = '\ufeff' + [headers,...rows].map(row => row.map(v => `"${String(v ?? '').replace(/"/g,'""')}"`).join(';')).join('\n');
  const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `leads-aprende-mais-${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

loginButton.addEventListener('click', login);
tokenInput.addEventListener('keydown', e => { if (e.key === 'Enter') login(); });
document.getElementById('refreshButton').addEventListener('click', loadLeads);
document.getElementById('logoutButton').addEventListener('click', logout);
document.getElementById('exportButton').addEventListener('click', exportCsv);
let timer;
searchInput.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(loadLeads, 300); });

if (token) showDashboard();
