// Shared across every authenticated page (dashboard, schedule).
// Handles the sidebar's logout form: hits the JSON logout endpoint,
// then sends the browser to /login regardless of the fetch outcome —
// the cookie is httpOnly so we can't clear it ourselves, and staying on
// a "logged in" page after a failed logout call would be worse than
// just re-checking auth on the next page load.

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('logoutForm');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    } catch (err) {
      // Ignore — we navigate to /login regardless.
    }
    window.location.href = '/login';
  });
});

// Small shared helper: format a Date as the value a
// <input type="datetime-local"> expects, in local time.
function toDatetimeLocalValue(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return (
    date.getFullYear() +
    '-' + pad(date.getMonth() + 1) +
    '-' + pad(date.getDate()) +
    'T' + pad(date.getHours()) +
    ':' + pad(date.getMinutes())
  );
}