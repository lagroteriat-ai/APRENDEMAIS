const PROTOTYPE_URL = 'https://aureaplay-ndghrrkn.manus.space/';
const form = document.getElementById('leadForm');
const message = document.getElementById('formMessage');
const submitButton = document.getElementById('submitLead');
document.getElementById('year').textContent = new Date().getFullYear();

document.querySelectorAll('a[href^="#"]').forEach(link => {
  link.addEventListener('click', event => {
    const target = document.querySelector(link.getAttribute('href'));
    if (target) { event.preventDefault(); target.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
  });
});

form.addEventListener('submit', async event => {
  event.preventDefault();
  message.textContent = '';
  message.className = 'form-message';
  submitButton.disabled = true;
  submitButton.innerHTML = 'Salvando cadastro...';

  const payload = {
    nome: document.getElementById('nome').value.trim(),
    sobrenome: document.getElementById('sobrenome').value.trim(),
    email: document.getElementById('email').value.trim(),
    telefone: document.getElementById('telefone').value.trim(),
    perfil: document.getElementById('perfil').value,
    consentimento: document.getElementById('consentimento').checked
  };

  try {
    const response = await fetch('/api/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await response.json();
    if (!response.ok || !data.ok) throw new Error(data.message || 'Não foi possível salvar o cadastro.');

    try {
      await fetch('/api/prototype-access', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ leadId: data.leadId })
      });
    } catch (_) {}

    message.textContent = 'Cadastro realizado! Abrindo o protótipo...';
    message.className = 'form-message success';
    window.setTimeout(() => { window.location.href = PROTOTYPE_URL; }, 600);
  } catch (error) {
    message.textContent = error.message || 'Ocorreu um erro. Tente novamente.';
    message.className = 'form-message error';
    submitButton.disabled = false;
    submitButton.innerHTML = 'Começar agora <span>→</span>';
  }
});
