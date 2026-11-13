function account() {
  $("#account").innerHTML = session
    ? `<span>${esc(session.user.name)}</span><button class="ghost" id="logout">Log out</button>`
    : "<span>Your next adventure awaits</span>";
  if ($("#logout"))
    $("#logout").onclick = () => {
      session = null;
      sessionStorage.removeItem("roam-session");
      dashboard = {};
      render();
    };
}
async function render() {
  account();
  notice("");
  if (!session) {
    renderAuth();
    return;
  }
  $("#content").innerHTML = '<div class="empty">Loading your journeys…</div>';
  try {
    dashboard = await api("/dashboard");
    if (view === "dashboard") renderDashboard();
    else renderPlan();
  } catch (e) {
    $("#content").innerHTML =
      '<div class="empty">Unable to load your journeys. Check the backend and database, then try again.</div>';
    notice(e.message);
  }
}
document.querySelectorAll("[data-view]").forEach((b) => (b.onclick = () => { view = b.dataset.view; render(); }));
$("#close-modal").onclick = () => $("#modal").close();
(async () => {
  try { tags = await api("/interests"); await render(); }
  catch (e) { account(); renderAuth(); notice("Could not load interests. Ensure PostgreSQL is running and run the schema and seed commands, then refresh. " + e.message); }
})();