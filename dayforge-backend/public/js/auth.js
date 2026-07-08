// Handles login/register form submission.
// Note: we never touch the JWT here. The server sets it as an httpOnly
// cookie on a successful response — the browser stores and sends it
// automatically on every future request. `credentials: 'include'` is the
// only thing that matters: it tells fetch to actually send/receive cookies.

function setupAuthForm({ formId, endpoint, onSuccess }) {
  const form = document.getElementById(formId);
  const errorBanner = document.getElementById('errorBanner');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorBanner.style.display = 'none';

    const email = form.querySelector('#email').value.trim();
    const password = form.querySelector('#password').value;

    const submitBtn = form.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Please wait…';

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        errorBanner.textContent = data.error || 'Something went wrong. Please try again.';
        errorBanner.style.display = 'block';
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
        return;
      }

      onSuccess(data);
    } catch (err) {
      errorBanner.textContent = 'Could not reach the server. Check your connection and try again.';
      errorBanner.style.display = 'block';
      submitBtn.disabled = false;
      submitBtn.textContent = originalText;
    }
  });
}

// Wiring lives here (not in inline <script> tags in the .ejs files) because
// helmet's default Content-Security-Policy is `script-src 'self'` — it has
// no 'unsafe-inline', so any inline <script> block is silently dropped by
// the browser. External same-origin files like this one are unaffected.
document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('loginForm')) {
    setupAuthForm({
      formId: 'loginForm',
      endpoint: '/api/auth/login',
      onSuccess: () => { window.location.href = '/dashboard'; },
    });
  }

  const registerForm = document.getElementById('registerForm');
  if (registerForm) {
    // Runs before setupAuthForm's own submit listener (registered next,
    // so it runs second) so a mismatch can stop the fetch from firing.
    registerForm.addEventListener('submit', (e) => {
      const password = document.getElementById('password').value;
      const confirm = document.getElementById('confirmPassword').value;
      const errorBanner = document.getElementById('errorBanner');

      if (password !== confirm) {
        e.preventDefault();
        e.stopImmediatePropagation();
        errorBanner.textContent = 'Passwords do not match.';
        errorBanner.style.display = 'block';
      }
    });

    setupAuthForm({
      formId: 'registerForm',
      endpoint: '/api/auth/register',
      onSuccess: () => { window.location.href = '/dashboard'; },
    });
  }
});