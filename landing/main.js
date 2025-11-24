// famly.ai landing page beta form handler
const form = document.getElementById('beta-form');
const emailInput = document.getElementById('beta-email');
const messageDiv = document.getElementById('beta-message');

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = emailInput.value.trim();
  if (!email) return;
  messageDiv.textContent = 'Submitting...';
  try {
    const res = await fetch('/api/auth/join-beta', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    if (res.ok) {
      messageDiv.textContent = 'Thank you! We’ll be in touch soon.';
      form.reset();
    } else {
      const data = await res.json().catch(() => ({}));
      messageDiv.textContent = data.detail || 'Could not join beta. Please try again later.';
      messageDiv.style.color = '#dc2626'; // red
    }
  } catch (err) {
    messageDiv.textContent = 'Could not join beta. Please try again later.';
    messageDiv.style.color = '#dc2626';
  }
});
