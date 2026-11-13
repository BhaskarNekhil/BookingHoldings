var $ = (s) => document.querySelector(s);
var esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
var money = (n) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n);
var date = (s) =>
  new Date(s).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
var notice = (s) => {
  $("#notice").textContent = s;
};
var chips = (selected = []) =>
  `<div class="chips">${tags.map((t) => `<label><input type="checkbox" name="interests" value="${esc(t.id)}" ${selected.includes(t.id) ? "checked" : ""}><span>${esc(t.label)}</span></label>`).join("")}</div>`;
var field = (label, name, type = "text", extra = "") =>
  `<div><label for="${name}">${label}</label><input id="${name}" name="${name}" type="${type}" ${extra} required></div>`;
