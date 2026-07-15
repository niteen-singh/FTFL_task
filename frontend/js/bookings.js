requireLogin();

const listEl = document.getElementById("bookings-list");
const statusEl = document.getElementById("status");

document.getElementById("logout-btn").addEventListener("click", logout);

function fmtDate(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function renderBookings(bookings) {
  listEl.innerHTML = "";

  if (bookings.length === 0) {
    listEl.innerHTML = '<p class="empty">You have no bookings yet.</p>';
    return;
  }

  bookings.forEach((b) => {
    const isActive = b.status === "active";
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      <p class="card-title">${escapeHtml(b.slot ? b.slot.title : "(slot deleted)")}</p>
      <p class="card-meta">${b.slot ? fmtDate(b.slot.startTime) : ""}</p>
      <div class="card-row">
        <span class="badge ${isActive ? "" : "cancelled"}">${b.status}</span>
        ${isActive ? '<button class="cancel-btn secondary">Cancel</button>' : ""}
      </div>
      <p class="status" data-booking-status></p>
    `;

    if (isActive) {
      const cancelBtn = card.querySelector(".cancel-btn");
      const bookingStatusEl = card.querySelector("[data-booking-status]");

      cancelBtn.addEventListener("click", async () => {
        // Same pattern as booking: disable immediately so a double-click
        // can't send two cancel requests for the same booking.
        if (cancelBtn.disabled) return;
        cancelBtn.disabled = true;
        cancelBtn.textContent = "Cancelling...";
        bookingStatusEl.textContent = "";
        bookingStatusEl.className = "status";

        const { ok, data } = await apiFetch(`/bookings/${b.id}`, { method: "DELETE" });

        if (!ok) {
          bookingStatusEl.textContent = data?.error || "Cancel failed.";
          bookingStatusEl.className = "status error";
          cancelBtn.disabled = false;
          cancelBtn.textContent = "Cancel";
          return;
        }

        await loadBookings();
      });
    }

    listEl.appendChild(card);
  });
}

async function loadBookings() {
  statusEl.textContent = "Loading...";
  statusEl.className = "status";

  const { ok, data } = await apiFetch("/me/bookings");

  if (!ok) {
    statusEl.textContent = data?.error || "Could not load bookings.";
    statusEl.className = "status error";
    return;
  }

  statusEl.textContent = "";
  renderBookings(data);
}

loadBookings();
