const prototypeUrl = 'https://aureaplay-ndghrrkn.manus.space/';

document.getElementById('year').textContent = new Date().getFullYear();

document.querySelectorAll('a[href^="#"]').forEach(link => {
  link.addEventListener('click', event => {
    const target = document.querySelector(link.getAttribute('href'));
    if (target) {
      event.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
});

document.getElementById('signupForm').addEventListener('submit', event => {
  event.preventDefault();

  const name = document.getElementById('nome').value.trim();
  const message = document.getElementById('formMessage');

  if (!name) return;

  message.textContent = `Tudo certo, ${name.split(' ')[0]}! Agora você pode conhecer o Aprende+.`;

  setTimeout(() => {
    window.open(prototypeUrl, '_blank', 'noopener,noreferrer');
  }, 700);
});
