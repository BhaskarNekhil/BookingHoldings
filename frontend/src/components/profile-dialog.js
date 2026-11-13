document.addEventListener("click", (e) => {
  const button = e.target.closest("[data-profile]");
  if (!button) return;
  busy(button, async () => {
    const p = await api(
      "/profiles/" + encodeURIComponent(button.dataset.profile),
    );
    $("#modal-body").innerHTML =
      `<span class="eyebrow">MEET YOUR TRAVEL COMPANION</span><h2>${esc(p.name)}</h2>
      <p class="sub">${esc(p.home_city || "Home city not provided")}</p>
      <dl><dt>Age</dt><dd>${esc(p.age ?? "Not provided")}</dd>
      <dt>Gender</dt><dd>${esc(p.gender)}</dd>
      <dt>Home airport</dt><dd>${esc(p.home_airport || "Not provided")}</dd>
      </dl>
      <h3>Gender requirements for active trips</h3>
      ${p.trip_preferences?.length ? p.trip_preferences.map((t) => `<div class="request"><span><strong>${t.role === "creator" ? "Creator trip" : "Seeker trip"} · ${esc(t.destination)}</strong><small>${interval(t.check_in, t.check_out)}</small></span><span class="badge">${t.gender_preference === "SAME_GENDER" ? "Same gender only" : "Any gender"}</span></div>`).join("") : '<p class="sub">No active trip requirements.</p>'}
      <h3>Interests</h3><div class="chips">${p.interests.length ? p.interests.map((i) => `<span class="badge">${esc(i.label)}</span>`).join("") : '<p class="sub">No interests added yet.</p>'}</div>`;
    if (!$("#modal").open) $("#modal").showModal();
  });
});

