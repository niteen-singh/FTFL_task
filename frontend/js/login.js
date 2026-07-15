const form = document.getElementById("login-form");
const statusEl = document.getElementById("status");
const submitBtn = document.getElementById("submit-btn");

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  submitBtn.disabled = true;
  statusEl.textContent = "";
  statusEl.className = "status";

  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  const { ok, data } = await apiFetch("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });

  if (!ok) {
    statusEl.textContent = data?.error || "Login failed.";
    statusEl.className = "status error";
    submitBtn.disabled = false;
    return;
  }

  setToken(data.token);
  window.location.href = "slots.html";
});
