async function showHotels(id) {
  const data = await api("/groups/" + encodeURIComponent(id) + "/hotels");
  const final = data.finalized_stay;
  const expenses = data.member_expenses || [];
  const recommended = data.recommended_room;
  const finalPanel = final
    ? `<article class="panel"><span class="badge">Group stay finalized</span><h3>${esc(final.hotel_name)} · ${esc(final.room_name)}</h3><p>${final.room_count} room(s) · ${money(final.total_cost_inr)} total</p><h4>Expenditure per member</h4>${expenses.map((x) => `<div class="request"><span>${esc(x.name)}</span><strong>${money(x.expenditure_inr)}</strong></div>`).join("")}<p class="sub">This saves the group's choice only. No hotel reservation or payment was made.</p></article>`
    : "";
  $("#results").innerHTML =
    `<div class="section-head"><div><span class="eyebrow">A PLACE TO CALL HOME</span><h2>Stay together in ${esc(data.destination)}</h2><p class="sub">${date(data.check_in)} - ${date(data.check_out)} · ${data.member_count} travellers · Budget cap: ${money(data.budget_limit_inr)} per person</p></div></div>${recommended && !final ? `<article class="panel"><span class="badge">Creator's current room recommendation</span><h3>${esc(recommended.hotel_name)} · ${esc(recommended.room_name)}</h3><p class="sub">Recommended by ${esc(recommended.recommended_by_name)}</p></article>` : ""}${finalPanel}${!final && data.hotels.length ? `<div class="cards">${data.hotels.map((h, i) => `<article class="card"><img src="/${esc(h.image)}" alt="${esc(h.hotel_name)}" loading="lazy"><div class="card-body">${recommended?.room_id === h.room_id ? '<span class="badge">Creator recommends this room</span>' : ""}<span class="badge">${h.rating} · ${h.stars} stars</span><h3>${esc(h.hotel_name)}</h3><p>${esc(h.room_name)} · ${h.rooms_required} room(s)<br>${h.refundable ? "Refundable" : "Non-refundable"} · ${money(h.total_cost_inr)} total</p><div class="price">${money(h.cost_per_member_inr)} <small>/ person for stay</small></div><button data-book="${i}">${data.can_recommend ? "Review this room" : "View room cost"}</button></div></article>`).join("")}</div>` : !final ? '<div class="empty">No stays fit your group size, dates and per-person budget.</div>' : ""}`;
  document.querySelectorAll("[data-book]").forEach(
    (b) =>
      (b.onclick = () => {
        const h = data.hotels[Number(b.dataset.book)];
        $("#modal-body").innerHTML =
          `<span class="eyebrow">PLAN WITH YOUR GROUP</span><h2>${esc(h.hotel_name)}</h2><p>${esc(h.room_name)} · ${h.rooms_required} room(s)</p><p>${money(h.total_cost_inr)} total · ${money(h.cost_per_member_inr)} estimated per person</p><p class="sub">A recommendation shares this room with seekers. Finalizing saves the choice and splits the cost among current group members. No reservation or payment will be made.</p>${data.can_recommend ? `<button id="recommend-room">${recommended?.room_id === h.room_id ? "Currently recommended" : "Recommend this room"}</button>` : ""}${data.can_finalize ? '<button id="finalize-stay">Finalize group stay</button>' : ""}<p id="room-action-message" class="sub" role="status"></p>`;
        $("#modal").showModal();
        const recommendButton = $("#recommend-room");
        if (recommendButton)
          recommendButton.onclick = async () => {
            recommendButton.disabled = true;
            try {
              await api(
                "/groups/" + encodeURIComponent(id) + "/recommendation",
                "PUT",
                { roomId: h.room_id },
              );
              await showHotels(id);
              $("#room-action-message").textContent =
                "Room recommendation saved. Seekers can see it in their group request.";
            } catch (e) {
              $("#room-action-message").textContent = e.message;
            } finally {
              recommendButton.disabled = false;
            }
          };
        const finalizeButton = $("#finalize-stay");
        if (finalizeButton)
          finalizeButton.onclick = async () => {
            finalizeButton.disabled = true;
            try {
              const result = await api(
                "/groups/" + encodeURIComponent(id) + "/finalize",
                "POST",
                { roomId: h.room_id },
              );
              dashboard = await api("/dashboard");
              await showHotels(id);
              $("#modal-body").innerHTML =
                `<span class="badge">Group finalized</span><h2>${esc(h.hotel_name)} · ${esc(h.room_name)}</h2><p>${result.roomCount} room(s) · ${money(result.totalCostInr)} total</p><h3>Expenditure per member</h3>${result.expenses.map((x) => `<div class="request"><span>${esc(x.name)}</span><strong>${money(x.expenditure_inr)}</strong></div>`).join("")}<p class="sub">This records the group's choice only. No reservation or payment was made.</p>`;
            } catch (e) {
              $("#room-action-message").textContent = e.message;
            } finally {
              finalizeButton.disabled = false;
            }
          };
      }),
  );
  $("#results").scrollIntoView({ behavior: "smooth" });
}
