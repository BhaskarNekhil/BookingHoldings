var statusLabel = (s) =>
  ({
    PENDING: "Pending",
    APPROVED: "Accepted",
    REJECTED: "Rejected",
    CANCELLED: "Cancelled",
  })[s] || s;
var statusBadge = (s) =>
  `<span class="badge status-${esc(s.toLowerCase())}">${esc(statusLabel(s))}</span>`;
var interval = (a, b) =>
  [a, b]
    .map((s) =>
      new Date(s).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      }),
    )
    .join(" - ");
function renderDashboard() {
  const created = dashboard.groups.filter(
    (g) => g.owner_id === session.user.id,
  );
  const joined = dashboard.groups.filter((g) => g.owner_id !== session.user.id);
  function people(g, status, title) {
    const rows = (dashboard.incoming || []).filter(
      (r) => r.group_id === g.id && r.status === status,
    );
    return `<section><h4>${title} (${rows.length})</h4>${rows.length ? rows.map((r) => `<div class="request"><span>${esc(r.name)}<small>${esc(r.home_city || "")}</small><button type="button" class="ghost" data-profile="${esc(r.seeker_id)}">View profile</button></span><div>${status === "PENDING" ? `<button data-review-inline="${r.id}" data-status="APPROVED">Accept</button><button class="ghost" data-review-inline="${r.id}" data-status="REJECTED">Reject</button>` : statusBadge(status)}</div></div>`).join("") : '<p class="sub">No travellers here yet.</p>'}</section>`;
  }
  const createdHtml = created.length
    ? created
        .map(
          (g) =>
            `<article class="panel"><span class="badge">${esc(g.destination)}</span> ${g.finalization_status === "finalized" ? statusBadge("FINALIZED") : ""}<h3>${esc(g.name)}</h3><button type="button" class="ghost" data-profile="${esc(g.owner_id)}">Creator profile</button><p class="sub">${interval(g.check_in, g.check_out)}<br>${g.member_count}/${g.max_size} travellers${g.finalized_cost_per_member_inr ? `<br>Final stay: ${esc(g.finalized_hotel_name)} · ${money(g.finalized_cost_per_member_inr)} per person` : ""}</p><button data-hotels="${esc(g.id)}">${g.finalization_status === "finalized" ? "View finalized stay" : "Compare stays"}</button><button class="ghost" data-delete-group="${esc(g.id)}">Delete group</button><div class="request-columns">${people(g, "PENDING", "Requested / Pending")}${people(g, "APPROVED", "Accepted")}${people(g, "REJECTED", "Rejected")}</div></article>`,
        )
        .join("")
    : '<div class="empty">No created groups yet. Create one from Explore trips.</div>';
  const soughtHtml = `<div class="panel"><h3>Your group requests</h3><p class="sub">Trip dates and the response to each request.</p>${dashboard.requests.length ? dashboard.requests.map((r) => `<div class="request"><span><strong>${esc(r.name)}</strong><button type="button" class="ghost" data-profile="${esc(r.owner_id)}">Creator profile</button><small>${esc(r.destination)} | Group trip: ${interval(r.check_in, r.check_out)}${r.recommended_hotel_name ? ` | Creator recommends: ${esc(r.recommended_hotel_name)} · ${esc(r.recommended_room_name)}` : ""}${r.expenditure_inr != null ? ` | Your share: ${money(r.expenditure_inr)}` : ""}</small></span><div>${statusBadge(r.status)}${r.status === "APPROVED" ? `<button data-hotels="${esc(r.group_id)}">${r.expenditure_inr != null ? "View finalized stay" : "Compare stays"}</button>` : ""}${["PENDING", "APPROVED"].includes(r.status) ? `<button class="ghost" data-leave-group="${esc(r.group_id)}">Remove</button>` : ""}</div></div>`).join("") : '<div class="empty">No requests sent yet.</div>'}</div>
    ${joined.length ? `<div class="panel"><h3>Accepted groups</h3>${joined.map((g) => `<div class="request"><span>${esc(g.name)}<button type="button" class="ghost" data-profile="${esc(g.owner_id)}">Creator profile</button><small>${esc(g.destination)} | ${interval(g.check_in, g.check_out)}${g.my_expenditure_inr != null ? ` | Your share: ${money(g.my_expenditure_inr)}` : ""}</small></span><div>${statusBadge(g.finalization_status === "finalized" ? "FINALIZED" : "APPROVED")}<button data-hotels="${esc(g.id)}">${g.finalization_status === "finalized" ? "View finalized stay" : "Compare stays"}</button><button class="ghost" data-leave-group="${esc(g.id)}">Leave group</button></div></div>`).join("")}</div>` : ""}
    <div class="panel"><h3>Your trip intervals</h3><p class="sub">Your saved seeker dates may differ from the group's dates above.</p>${dashboard.trips.length ? dashboard.trips.map((t) => `<div class="request"><span>${esc(t.destination)}<small>${interval(t.check_in, t.check_out)} | ${money(t.budget_inr)}</small></span><button data-match="${t.id}">See matches</button></div>`).join("") : '<p class="sub">No saved seeker trips yet.</p>'}</div>`;
  $("#content").innerHTML =
    `<div class="section-head"><h2>Your journeys</h2><button id="refresh" class="ghost">Refresh</button></div><div class="tabs" role="group" aria-label="Journey type"><button id="created-tab" aria-pressed="${journeyTab === "created"}" class="${journeyTab === "created" ? "active" : ""}">Created</button><button id="seeked-tab" aria-pressed="${journeyTab === "seeked"}" class="${journeyTab === "seeked" ? "active" : ""}">Seeked</button></div>${journeyTab === "created" ? createdHtml : soughtHtml}<div id="results"></div>`;
  $("#created-tab").onclick = () => {
    journeyTab = "created";
    renderDashboard();
  };
  $("#seeked-tab").onclick = () => {
    journeyTab = "seeked";
    renderDashboard();
  };
  $("#refresh").onclick = () => render();
  document
    .querySelectorAll("[data-match]")
    .forEach(
      (b) => (b.onclick = () => busy(b, () => showMatches(b.dataset.match))),
    );
  document
    .querySelectorAll("[data-hotels]")
    .forEach(
      (b) => (b.onclick = () => busy(b, () => showHotels(b.dataset.hotels))),
    );
  document.querySelectorAll("[data-delete-group]").forEach(
    (b) =>
      (b.onclick = () =>
        busy(b, async () => {
          if (
            !confirm(
              "Delete this group and its requests? This cannot be undone.",
            )
          )
            return;
          await api(
            "/groups/" + encodeURIComponent(b.dataset.deleteGroup),
            "DELETE",
          );
          dashboard = await api("/dashboard");
          renderDashboard();
          notice("Group deleted.");
        })),
  );
  document.querySelectorAll("[data-leave-group]").forEach(
    (b) =>
      (b.onclick = () =>
        busy(b, async () => {
          if (!confirm("Remove this group from your journeys?")) return;
          await api(
            "/groups/" +
              encodeURIComponent(b.dataset.leaveGroup) +
              "/membership",
            "DELETE",
          );
          dashboard = await api("/dashboard");
          renderDashboard();
          notice("Group removed from your journeys.");
        })),
  );
  document.querySelectorAll("[data-review-inline]").forEach(
    (b) =>
      (b.onclick = () =>
        busy(b, async () => {
          await api("/groups/requests/" + b.dataset.reviewInline, "PATCH", {
            status: b.dataset.status,
          });
          dashboard = await api("/dashboard");
          renderDashboard();
          notice(
            "Request " + statusLabel(b.dataset.status).toLowerCase() + ".",
          );
        })),
  );
}
async function showRequests(id) {
  const requests = await api("/groups/" + encodeURIComponent(id) + "/requests");
  $("#modal-body").innerHTML =
    `<h2>Travel better, together.</h2><p class="sub">Review the travellers who want to join you.</p>${requests.length ? requests.map((r) => `<div class="request"><span>${esc(r.name)}<small>${esc(r.home_city)} · ${esc(r.gender)}</small></span><div>${r.status === "PENDING" ? `<button data-review="${r.id}" data-status="APPROVED">Approve</button><button class="ghost" data-review="${r.id}" data-status="REJECTED">Decline</button>` : `<span class="badge">${esc(r.status)}</span>`}</div></div>`).join("") : '<div class="empty">No requests yet. Check back soon.</div>'}`;
  if (!$("#modal").open) $("#modal").showModal();
  document.querySelectorAll("[data-review]").forEach(
    (b) =>
      (b.onclick = () =>
        busy(b, async () => {
          await api("/groups/requests/" + b.dataset.review, "PATCH", {
            status: b.dataset.status,
          });
          await showRequests(id);
        })),
  );
}
