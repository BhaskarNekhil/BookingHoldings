function renderPlan() {
  destination = "";
  const genderPreferenceField = `<div><label for="genderPreference">Who would you like to travel with?</label><select name="genderPreference" id="genderPreference" required><option value="ANY">Any gender</option><option value="SAME_GENDER">Same gender as me only</option></select></div>`;
  $("#content").innerHTML =
    `<div class="panel"><div class="section-head" style="margin-top:0"><div><h2>A great trip starts with a connection.</h2><p class="sub">Choose your dates. We'll help you find the company.</p></div><span class="badge">01 / Plan your trip</span></div><div class="tabs"><button id="seeker" class="${role === "seeker" ? "active" : ""}">Find a group</button><button id="creator" class="${role === "creator" ? "active" : ""}">Create a group</button></div><form id="trip-form"><div class="form-grid"><div class="location-wrap"><label for="destination">Where do you want to go?</label><input id="destination" autocomplete="off" placeholder="Try Kyoto, Tokyo or Dubai." required aria-controls="suggestions"><div id="suggestions"></div></div>${field("Budget per person (INR)", "budgetInr", "number", 'min="1" value="62000"')}${field("Check-in", "checkIn", "date", 'min="2027-04-01" max="2027-04-19" value="2027-04-10"')}${field("Check-out", "checkOut", "date", 'min="2027-04-02" max="2027-04-20" value="2027-04-15"')}${genderPreferenceField}${role === "creator" ? `${field("Give your group a name", "name", "text", 'maxlength="150"')}<div><label for="maxSize">Total travellers (including you)</label><select name="maxSize" id="maxSize"><option>2</option><option selected>3</option><option>4</option></select></div><div class="wide"><label for="itinerary">What's the plan?</label><textarea name="itinerary" id="itinerary" placeholder="Temple walks, market lunches, and a little room for discovery." required></textarea></div>` : ""}<div class="wide"><label>What makes a trip yours? Select at least two interests.</label>${chips(dashboard.interests)}</div></div><div class="actions"><button type="submit">${role === "creator" ? "Create my group" : "Find my people"}</button><small>Available stays: 1-20 April 2027</small></div></form></div><div id="results"></div>`;
  $("#seeker").onclick = () => {
    role = "seeker";
    renderPlan();
  };
  $("#creator").onclick = () => {
    role = "creator";
    renderPlan();
  };
  let timer;
  $("#destination").oninput = () => {
    destination = "";
    const version = ++searchVersion;
    clearTimeout(timer);
    const q = $("#destination").value.trim();
    $("#suggestions").innerHTML = "";
    if (q.length < 2) return;
    timer = setTimeout(async () => {
      try {
        const rows = await api("/locations/search?q=" + encodeURIComponent(q));
        if (version !== searchVersion || !$("#suggestions")) return;
        $("#suggestions").innerHTML = rows.length
          ? rows
              .map(
                (r) =>
                  `<button type="button" data-city="${esc(r.city)}">${esc(r.city)} <small>· ${esc(r.country)}</small></button>`,
              )
              .join("")
          : "<p>No destinations found. Try another spelling.</p>";
        $("#suggestions")
          .querySelectorAll("button")
          .forEach(
            (b) =>
              (b.onclick = () => {
                destination = b.dataset.city;
                $("#destination").value = destination;
                $("#suggestions").innerHTML = "";
              }),
          );
      } catch (e) {
        notice(e.message);
      }
    }, 250);
  };
  $("#trip-form").onsubmit = (e) => {
    e.preventDefault();
    busy(e.submitter, async () => {
      const f = new FormData(e.target);
      if (!destination)
        throw Error("Select a destination from the search suggestions.");
      if (f.get("checkOut") <= f.get("checkIn"))
        throw Error("Check-out must be after check-in.");
      if (f.getAll("interests").length < 2)
        throw Error("Choose at least two interests.");
      const body = {
        ...Object.fromEntries(f),
        role,
        destination,
        budgetInr: Number(f.get("budgetInr")),
        maxSize: Number(f.get("maxSize")),
        interests: f.getAll("interests"),
      };
      if (role === "creator") {
        await api("/groups", "POST", body);
        view = "dashboard";
        await render();
        notice(
          "Your group is ready. New requests will appear under Manage requests.",
        );
      } else {
        const { trip } = await api("/trips", "POST", body);
        await showMatches(trip.id);
      }
    });
  };
}
async function showMatches(id) {
  const { matches } = await api("/matches?tripId=" + id);
  const target = $("#results") || $("#content");
  target.innerHTML = `<div class="section-head"><div><span class="eyebrow">YOUR NEXT CHAPTER</span><h2>${matches.length} groups to connect with</h2></div></div>${matches.length ? `<div class="cards">${matches.map((g) => `<article class="card"><div class="card-body"><span class="badge">${esc(g.destination)}</span><h3>${esc(g.name)}</h3><p>With ${esc(g.owner_name)} <button type="button" class="ghost" data-profile="${esc(g.owner_id)}">View profile</button> · ${g.member_count}/${g.max_size} travellers<br>${date(g.check_in)} – ${date(g.check_out)}</p><p>${esc(g.itinerary || "An adventure waiting to happen.")}</p>${g.shared_interests.map((i) => `<span class="badge">${esc(tags.find((t) => t.id === i)?.label || i)}</span>`).join("")}<p>✓ ${g.overlapping_nights} shared nights · Compatible budget</p><div class="price">${money(g.budget_inr)} <small>/ person</small></div><button data-join="${esc(g.id)}">I’m interested ↗</button></div></article>`).join("")}</div>` : '<div class="empty">No compatible groups yet. Try different dates, interests or a closer budget.</div>'}`;
  target.querySelectorAll("[data-join]").forEach(
    (b) =>
      (b.onclick = () =>
        busy(b, async () => {
          await api(
            "/groups/" + encodeURIComponent(b.dataset.join) + "/requests",
            "POST",
            {},
          );
          b.textContent = "Request sent ✓";
          b.onclick = null;
          notice("Request sent. Check My journeys for the owner’s response.");
        })),
  );
  target.scrollIntoView({ behavior: "smooth", block: "start" });
}
