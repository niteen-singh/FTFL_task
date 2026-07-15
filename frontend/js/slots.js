requireLogin();

const listEl = document.getElementById("slots-list");
const statusEl = document.getElementById("status");

document.getElementById("logout-btn").addEventListener("click", logout);

function fmtDate(iso) {
  return new Date(iso).toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function renderSlots(slots) {
  listEl.innerHTML = "";

  if (slots.length === 0) {
    listEl.innerHTML = '<p class="empty">No slots available.</p>';
    return;
  }

  slots.forEach((slot) => {
    const full = slot.seatsRemaining <= 0;

    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      <p class="card-title">${escapeHtml(slot.title)}</p>
      <p class="card-meta">${fmtDate(slot.startTime)} &middot; ${escapeHtml(slot.description || "")}</p>
      <div class="card-row">
        <span class="badge ${full ? "full" : ""}">${slot.seatsRemaining} / ${slot.capacity} seats left</span>
        <button class="book-btn" ${full ? "disabled" : ""}>${full ? "Full" : "Book"}</button>
      </div>
      <p class="status" data-slot-status></p>
    `;

    const bookBtn = card.querySelector(".book-btn");
    const slotStatusEl = card.querySelector("[data-slot-status]");

    bookBtn.addEventListener("click", async () => {
      // Disable synchronously, before any await, so a rapid double-click
      // (or a second click queued while the first request is in flight)
      // can never fire a second booking request for this slot.
      if (bookBtn.disabled) return;
      bookBtn.disabled = true;
      bookBtn.textContent = "Booking...";
      slotStatusEl.textContent = "";
      slotStatusEl.className = "status";

      const { ok, data } = await apiFetch(`/slots/${slot.id}/book`, { method: "POST" });

      if (!ok) {
        slotStatusEl.textContent = data?.error || "Booking failed.";
        slotStatusEl.className = "status error";
        // Re-enable only if the slot might still be bookable - a fresh
        // reload of the list will correctly re-disable it if it's full.
        bookBtn.disabled = false;
        bookBtn.textContent = "Book";
        return;
      }

      slotStatusEl.textContent = "Booked!";
      slotStatusEl.className = "status success";
      await loadSlots(); // re-fetch so all cards reflect the true server state
    });

    listEl.appendChild(card);
  });
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

async function loadSlots() {
  statusEl.textContent = "Loading...";
  statusEl.className = "status";

  const { ok, data } = await apiFetch("/slots");

  if (!ok) {
    statusEl.textContent = data?.error || "Could not load slots.";
    statusEl.className = "status error";
    return;
  }

  statusEl.textContent = "";
  renderSlots(data);
}

loadSlots();
