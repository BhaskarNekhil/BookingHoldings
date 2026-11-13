const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let session = null;
try { session = JSON.parse(sessionStorage.getItem('roam-session')); } catch {}
let tags = [], dashboard = {}, role = 'seeker', destination = '', view = 'plan', signup = false, searchVersion = 0;
const money = n => new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:0}).format(n);
const date = s => new Date(s).toLocaleDateString('en-GB',{day:'numeric',month:'short'});
const notice = s => { $('#notice').textContent = s; };
async function api(url, method='GET', body) {
  const headers={'Content-Type':'application/json',...(session ? {Authorization:'Bearer '+session.token}: {})};
  if (['POST','PATCH','PUT','DELETE'].includes(method)) headers['Idempotency-Key']=crypto.randomUUID();
  const r = await fetch('/api'+url,{method,headers,...(body ? {body:JSON.stringify(body)}:{})});
  const data = await r.json();
  if (!r.ok) throw new Error(data.message || 'Something went wrong. Please try again.');
  return data;
}
const chips = (selected=[]) => `<div class="chips">${tags.map(t=>`<label><input type="checkbox" name="interests" value="${esc(t.id)}" ${selected.includes(t.id)?'checked':''}><span>${esc(t.label)}</span></label>`).join('')}</div>`;
const field = (label,name,type='text',extra='') => `<div><label for="${name}">${label}</label><input id="${name}" name="${name}" type="${type}" ${extra} required></div>`;
function account() {
  $('#account').innerHTML = session ? `<span>${esc(session.user.name)}</span><button class="ghost" id="logout">Log out</button>` : '<span>Your next adventure awaits</span>';
  if ($('#logout')) $('#logout').onclick=()=>{session=null;sessionStorage.removeItem('roam-session');dashboard={};render();};
}
function renderAuth() {
  $('#content').innerHTML=`<div class="panel auth"><span class="eyebrow">LET’S GET YOU GOING</span><h2>${signup?'Meet your travel people.':'Welcome back, explorer.'}</h2><p class="sub">${signup?'A few details to find travellers who share your interests.':'Log in to plan your next shared adventure.'}</p><div class="tabs"><button id="login-tab" class="${!signup?'active':''}">Log in</button><button id="signup-tab" class="${signup?'active':''}">Sign up</button></div><form id="auth-form"><div class="form-grid">${signup?field('Your name','name'):''}${field('Email address','email','email')}${field('Password','password','password','minlength="8" autocomplete="'+(signup?'new-password':'current-password')+'"')}${signup?`${field('Age','age','number','min="18" max="120"')}${field('Home city','homeCity')}<div><label for="gender">Gender</label><select name="gender" id="gender"><option value="FEMALE">Female</option><option value="MALE">Male</option></select></div><div><label for="genderPreference">Travel companions</label><select name="genderPreference" id="genderPreference"><option value="ANY">Any gender</option><option value="SAME_GENDER">Same gender</option></select></div><div class="wide"><label>Your interests</label>${chips()}</div>`:''}</div><div class="actions"><button type="submit">${signup?'Create account':'Log in'} ↗</button></div></form></div>`;
  $('#login-tab').onclick=()=>{signup=false;renderAuth();}; $('#signup-tab').onclick=()=>{signup=true;renderAuth();};
  $('#auth-form').onsubmit=async e=>{e.preventDefault();await busy(e.submitter,async()=>{const f=new FormData(e.target);session=await api('/auth/'+(signup?'signup':'login'),'POST',{...Object.fromEntries(f),age:f.get('age')?Number(f.get('age')):undefined,interests:f.getAll('interests')});sessionStorage.setItem('roam-session',JSON.stringify(session));await render();});};
}
async function busy(button, fn) { notice('');button.disabled=true;try{await fn();}catch(e){notice(e.message);}finally{button.disabled=false;} }
async function render() {
  account();notice('');
  if (!session) { renderAuth();return; }
  $('#content').innerHTML='<div class="empty">Loading your journeys…</div>';
  try { dashboard=await api('/dashboard');if(view==='dashboard') renderDashboard();else renderPlan(); }
  catch(e){$('#content').innerHTML='<div class="empty">Unable to load your journeys. Check the backend and database, then try again.</div>';notice(e.message);}
}
function renderPlan() {
  destination='';
  $('#content').innerHTML=`<div class="panel"><div class="section-head" style="margin-top:0"><div><h2>A great trip starts with a connection.</h2><p class="sub">Choose your dates. We’ll help you find the company.</p></div><span class="badge">01 / Plan your trip</span></div><div class="tabs"><button id="seeker" class="${role==='seeker'?'active':''}">↗ Find a group</button><button id="creator" class="${role==='creator'?'active':''}">＋ Create a group</button></div><form id="trip-form"><div class="form-grid"><div class="location-wrap"><label for="destination">Where do you want to go?</label><input id="destination" autocomplete="off" placeholder="Try Kyoto, Tokyo or Dubai…" required aria-controls="suggestions"><div id="suggestions"></div></div>${field('Budget per person (INR)','budgetInr','number','min="1" value="62000"')} ${field('Check-in','checkIn','date','min="2027-04-01" max="2027-04-19" value="2027-04-10"')}${field('Check-out','checkOut','date','min="2027-04-02" max="2027-04-20" value="2027-04-15"')}${role==='creator'?`${field('Give your group a name','name','text','maxlength="150"')}<div><label for="maxSize">Total travellers (including you)</label><select name="maxSize" id="maxSize"><option>2</option><option selected>3</option><option>4</option></select></div><div class="wide"><label for="itinerary">What’s the plan?</label><textarea name="itinerary" id="itinerary" placeholder="Temple walks, market lunches, and a little room for discovery…" required></textarea></div>`:''}<div class="wide"><label>What makes a trip yours? Select at least two interests.</label>${chips(dashboard.interests)}</div></div><div class="actions"><button type="submit">${role==='creator'?'Create my group':'Find my people'} ↗</button><small>Available stays: 1–20 April 2027</small></div></form></div><div id="results"></div>`;
  $('#seeker').onclick=()=>{role='seeker';renderPlan();};$('#creator').onclick=()=>{role='creator';renderPlan();};
  let timer;
  $('#destination').oninput=()=>{destination='';const version=++searchVersion;clearTimeout(timer);const q=$('#destination').value.trim();$('#suggestions').innerHTML='';if(q.length<2)return;timer=setTimeout(async()=>{try{const rows=await api('/locations/search?q='+encodeURIComponent(q));if(version!==searchVersion||!$('#suggestions'))return;$('#suggestions').innerHTML=rows.length?rows.map(r=>`<button type="button" data-city="${esc(r.city)}">${esc(r.city)} <small>· ${esc(r.country)}</small></button>`).join(''):'<p>No destinations found. Try another spelling.</p>';$('#suggestions').querySelectorAll('button').forEach(b=>b.onclick=()=>{destination=b.dataset.city;$('#destination').value=destination;$('#suggestions').innerHTML='';});}catch(e){notice(e.message);}},250);};
  $('#trip-form').onsubmit=e=>{e.preventDefault();busy(e.submitter,async()=>{const f=new FormData(e.target);if(!destination)throw Error('Select a destination from the search suggestions.');if(f.get('checkOut')<=f.get('checkIn'))throw Error('Check-out must be after check-in.');if(f.getAll('interests').length<2)throw Error('Choose at least two interests.');const body={...Object.fromEntries(f),role,destination,budgetInr:Number(f.get('budgetInr')),maxSize:Number(f.get('maxSize')),interests:f.getAll('interests')};if(role==='creator'){await api('/groups','POST',body);view='dashboard';await render();notice('Your group is ready. New requests will appear under Manage requests.');}else{const {trip}=await api('/trips','POST',body);await showMatches(trip.id);}});};
}
async function showMatches(id) {
  const {matches}=await api('/matches?tripId='+id);
  const target=$('#results')||$('#content');
  target.innerHTML=`<div class="section-head"><div><span class="eyebrow">YOUR NEXT CHAPTER</span><h2>${matches.length} groups to connect with</h2></div></div>${matches.length?`<div class="cards">${matches.map(g=>`<article class="card"><div class="card-body"><span class="badge">${esc(g.destination)}</span><h3>${esc(g.name)}</h3><p>With ${esc(g.owner_name)} <button type="button" class="ghost" data-profile="${esc(g.owner_id)}">View profile</button> · ${g.member_count}/${g.max_size} travellers<br>${date(g.check_in)} – ${date(g.check_out)}</p><p>${esc(g.itinerary||'An adventure waiting to happen.')}</p>${g.shared_interests.map(i=>`<span class="badge">${esc(tags.find(t=>t.id===i)?.label||i)}</span>`).join('')}<p>✓ ${g.overlapping_nights} shared nights · Compatible budget</p><div class="price">${money(g.budget_inr)} <small>/ person</small></div><button data-join="${esc(g.id)}">I’m interested ↗</button></div></article>`).join('')}</div>`:'<div class="empty">No compatible groups yet. Try different dates, interests or a closer budget.</div>'}`;
  target.querySelectorAll('[data-join]').forEach(b=>b.onclick=()=>busy(b,async()=>{await api('/groups/'+encodeURIComponent(b.dataset.join)+'/requests','POST',{});b.textContent='Request sent ✓';b.onclick=null;notice('Request sent. Check My journeys for the owner’s response.');}));
  target.scrollIntoView({behavior:'smooth',block:'start'});
}
let journeyTab = 'created';
const statusLabel = s => ({PENDING:'Pending',APPROVED:'Accepted',REJECTED:'Rejected',CANCELLED:'Cancelled'}[s] || s);
const statusBadge = s => `<span class="badge status-${esc(s.toLowerCase())}">${esc(statusLabel(s))}</span>`;
const interval = (a,b) => [a,b].map(s=>new Date(s).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'})).join(' - ');
function renderDashboard() {
  const created=dashboard.groups.filter(g=>g.owner_id===session.user.id);
  const joined=dashboard.groups.filter(g=>g.owner_id!==session.user.id);
  function people(g,status,title) {
    const rows=(dashboard.incoming||[]).filter(r=>r.group_id===g.id&&r.status===status);
    return `<section><h4>${title} (${rows.length})</h4>${rows.length?rows.map(r=>`<div class="request"><span>${esc(r.name)}<small>${esc(r.home_city||'')}</small><button type="button" class="ghost" data-profile="${esc(r.seeker_id)}">View profile</button></span><div>${status==='PENDING'?`<button data-review-inline="${r.id}" data-status="APPROVED">Accept</button><button class="ghost" data-review-inline="${r.id}" data-status="REJECTED">Reject</button>`:statusBadge(status)}</div></div>`).join(''):'<p class="sub">No travellers here yet.</p>'}</section>`;
  }
  const createdHtml=created.length?created.map(g=>`<article class="panel"><span class="badge">${esc(g.destination)}</span> ${g.finalization_status==='finalized'?statusBadge('FINALIZED'):''}<h3>${esc(g.name)}</h3><button type="button" class="ghost" data-profile="${esc(g.owner_id)}">Creator profile</button><p class="sub">${interval(g.check_in,g.check_out)}<br>${g.member_count}/${g.max_size} travellers${g.finalized_cost_per_member_inr?`<br>Final stay: ${esc(g.finalized_hotel_name)} · ${money(g.finalized_cost_per_member_inr)} per person`:''}</p><button data-hotels="${esc(g.id)}">${g.finalization_status==='finalized'?'View finalized stay':'Compare stays'}</button><button class="ghost" data-delete-group="${esc(g.id)}">Delete group</button><div class="request-columns">${people(g,'PENDING','Requested / Pending')}${people(g,'APPROVED','Accepted')}${people(g,'REJECTED','Rejected')}</div></article>`).join(''):'<div class="empty">No created groups yet. Create one from Explore trips.</div>';
  const soughtHtml=`<div class="panel"><h3>Your group requests</h3><p class="sub">Trip dates and the response to each request.</p>${dashboard.requests.length?dashboard.requests.map(r=>`<div class="request"><span><strong>${esc(r.name)}</strong><button type="button" class="ghost" data-profile="${esc(r.owner_id)}">Creator profile</button><small>${esc(r.destination)} | Group trip: ${interval(r.check_in,r.check_out)}${r.recommended_hotel_name?` | Creator recommends: ${esc(r.recommended_hotel_name)} · ${esc(r.recommended_room_name)}`:''}${r.expenditure_inr!=null?` | Your share: ${money(r.expenditure_inr)}`:''}</small></span><div>${statusBadge(r.status)}${r.status==='APPROVED'?`<button data-hotels="${esc(r.group_id)}">${r.expenditure_inr!=null?'View finalized stay':'Compare stays'}</button>`:''}${['PENDING','APPROVED'].includes(r.status)?`<button class="ghost" data-leave-group="${esc(r.group_id)}">Remove</button>`:''}</div></div>`).join(''):'<div class="empty">No requests sent yet.</div>'}</div>
    ${joined.length?`<div class="panel"><h3>Accepted groups</h3>${joined.map(g=>`<div class="request"><span>${esc(g.name)}<button type="button" class="ghost" data-profile="${esc(g.owner_id)}">Creator profile</button><small>${esc(g.destination)} | ${interval(g.check_in,g.check_out)}${g.my_expenditure_inr!=null?` | Your share: ${money(g.my_expenditure_inr)}`:''}</small></span><div>${statusBadge(g.finalization_status==='finalized'?'FINALIZED':'APPROVED')}<button data-hotels="${esc(g.id)}">${g.finalization_status==='finalized'?'View finalized stay':'Compare stays'}</button><button class="ghost" data-leave-group="${esc(g.id)}">Leave group</button></div></div>`).join('')}</div>`:''}
    <div class="panel"><h3>Your trip intervals</h3><p class="sub">Your saved seeker dates may differ from the group's dates above.</p>${dashboard.trips.length?dashboard.trips.map(t=>`<div class="request"><span>${esc(t.destination)}<small>${interval(t.check_in,t.check_out)} | ${money(t.budget_inr)}</small></span><button data-match="${t.id}">See matches</button></div>`).join(''):'<p class="sub">No saved seeker trips yet.</p>'}</div>`;
  $('#content').innerHTML=`<div class="section-head"><h2>Your journeys</h2><button id="refresh" class="ghost">Refresh</button></div><div class="tabs" role="group" aria-label="Journey type"><button id="created-tab" aria-pressed="${journeyTab==='created'}" class="${journeyTab==='created'?'active':''}">Created</button><button id="seeked-tab" aria-pressed="${journeyTab==='seeked'}" class="${journeyTab==='seeked'?'active':''}">Seeked</button></div>${journeyTab==='created'?createdHtml:soughtHtml}<div id="results"></div>`;
  $('#created-tab').onclick=()=>{journeyTab='created';renderDashboard();};
  $('#seeked-tab').onclick=()=>{journeyTab='seeked';renderDashboard();};
  $('#refresh').onclick=()=>render();
  document.querySelectorAll('[data-match]').forEach(b=>b.onclick=()=>busy(b,()=>showMatches(b.dataset.match)));
  document.querySelectorAll('[data-hotels]').forEach(b=>b.onclick=()=>busy(b,()=>showHotels(b.dataset.hotels)));
  document.querySelectorAll('[data-delete-group]').forEach(b=>b.onclick=()=>busy(b,async()=>{if(!confirm('Delete this group and its requests? This cannot be undone.'))return;await api('/groups/'+encodeURIComponent(b.dataset.deleteGroup),'DELETE');dashboard=await api('/dashboard');renderDashboard();notice('Group deleted.');}));
  document.querySelectorAll('[data-leave-group]').forEach(b=>b.onclick=()=>busy(b,async()=>{if(!confirm('Remove this group from your journeys?'))return;await api('/groups/'+encodeURIComponent(b.dataset.leaveGroup)+'/membership','DELETE');dashboard=await api('/dashboard');renderDashboard();notice('Group removed from your journeys.');}));
  document.querySelectorAll('[data-review-inline]').forEach(b=>b.onclick=()=>busy(b,async()=>{
    await api('/groups/requests/'+b.dataset.reviewInline,'PATCH',{status:b.dataset.status});
    dashboard=await api('/dashboard');renderDashboard();
    notice('Request '+statusLabel(b.dataset.status).toLowerCase()+'.');
  }));
}
async function showRequests(id) {
  const requests=await api('/groups/'+encodeURIComponent(id)+'/requests');
  $('#modal-body').innerHTML=`<h2>Travel better, together.</h2><p class="sub">Review the travellers who want to join you.</p>${requests.length?requests.map(r=>`<div class="request"><span>${esc(r.name)}<small>${esc(r.home_city)} · ${esc(r.gender)}</small></span><div>${r.status==='PENDING'?`<button data-review="${r.id}" data-status="APPROVED">Approve</button><button class="ghost" data-review="${r.id}" data-status="REJECTED">Decline</button>`:`<span class="badge">${esc(r.status)}</span>`}</div></div>`).join(''):'<div class="empty">No requests yet. Check back soon.</div>'}`;
  if(!$('#modal').open)$('#modal').showModal();
  document.querySelectorAll('[data-review]').forEach(b=>b.onclick=()=>busy(b,async()=>{await api('/groups/requests/'+b.dataset.review,'PATCH',{status:b.dataset.status});await showRequests(id);}));
}
async function showHotels(id) {
  const data=await api('/groups/'+encodeURIComponent(id)+'/hotels');
  const final=data.finalized_stay;
  const expenses=data.member_expenses||[];
  const recommended=data.recommended_room;
  const finalPanel=final?`<article class="panel"><span class="badge">Group stay finalized</span><h3>${esc(final.hotel_name)} · ${esc(final.room_name)}</h3><p>${final.room_count} room(s) · ${money(final.total_cost_inr)} total</p><h4>Expenditure per member</h4>${expenses.map(x=>`<div class="request"><span>${esc(x.name)}</span><strong>${money(x.expenditure_inr)}</strong></div>`).join('')}<p class="sub">This saves the group's choice only. No hotel reservation or payment was made.</p></article>`:'';
  $('#results').innerHTML=`<div class="section-head"><div><span class="eyebrow">A PLACE TO CALL HOME</span><h2>Stay together in ${esc(data.destination)}</h2><p class="sub">${date(data.check_in)} - ${date(data.check_out)} · ${data.member_count} travellers · Budget cap: ${money(data.budget_limit_inr)} per person</p></div></div>${recommended&&!final?`<article class="panel"><span class="badge">Creator's current room recommendation</span><h3>${esc(recommended.hotel_name)} · ${esc(recommended.room_name)}</h3><p class="sub">Recommended by ${esc(recommended.recommended_by_name)}</p></article>`:''}${finalPanel}${!final&&data.hotels.length?`<div class="cards">${data.hotels.map((h,i)=>`<article class="card"><img src="/${esc(h.image)}" alt="${esc(h.hotel_name)}" loading="lazy"><div class="card-body">${recommended?.room_id===h.room_id?'<span class="badge">Creator recommends this room</span>':''}<span class="badge">${h.rating} · ${h.stars} stars</span><h3>${esc(h.hotel_name)}</h3><p>${esc(h.room_name)} · ${h.rooms_required} room(s)<br>${h.refundable?'Refundable':'Non-refundable'} · ${money(h.total_cost_inr)} total</p><div class="price">${money(h.cost_per_member_inr)} <small>/ person for stay</small></div><button data-book="${i}">${data.can_recommend?'Review this room':'View room cost'}</button></div></article>`).join('')}</div>`:!final?'<div class="empty">No stays fit your group size, dates and per-person budget.</div>':''}`;
  document.querySelectorAll('[data-book]').forEach(b=>b.onclick=()=>{
    const h=data.hotels[Number(b.dataset.book)];
    $('#modal-body').innerHTML=`<span class="eyebrow">PLAN WITH YOUR GROUP</span><h2>${esc(h.hotel_name)}</h2><p>${esc(h.room_name)} · ${h.rooms_required} room(s)</p><p>${money(h.total_cost_inr)} total · ${money(h.cost_per_member_inr)} estimated per person</p><p class="sub">A recommendation shares this room with seekers. Finalizing saves the choice and splits the cost among current group members. No reservation or payment will be made.</p>${data.can_recommend?`<button id="recommend-room">${recommended?.room_id===h.room_id?'Currently recommended':'Recommend this room'}</button>`:''}${data.can_finalize?'<button id="finalize-stay">Finalize group stay</button>':''}<p id="room-action-message" class="sub" role="status"></p>`;
    $('#modal').showModal();
    const recommendButton=$('#recommend-room');
    if(recommendButton)recommendButton.onclick=async()=>{recommendButton.disabled=true;try{await api('/groups/'+encodeURIComponent(id)+'/recommendation','PUT',{roomId:h.room_id});await showHotels(id);$('#room-action-message').textContent='Room recommendation saved. Seekers can see it in their group request.';}catch(e){$('#room-action-message').textContent=e.message;}finally{recommendButton.disabled=false;}};
    const finalizeButton=$('#finalize-stay');
    if(finalizeButton)finalizeButton.onclick=async()=>{finalizeButton.disabled=true;try{const result=await api('/groups/'+encodeURIComponent(id)+'/finalize','POST',{roomId:h.room_id});dashboard=await api('/dashboard');await showHotels(id);$('#modal-body').innerHTML=`<span class="badge">Group finalized</span><h2>${esc(h.hotel_name)} · ${esc(h.room_name)}</h2><p>${result.roomCount} room(s) · ${money(result.totalCostInr)} total</p><h3>Expenditure per member</h3>${result.expenses.map(x=>`<div class="request"><span>${esc(x.name)}</span><strong>${money(x.expenditure_inr)}</strong></div>`).join('')}<p class="sub">This records the group's choice only. No reservation or payment was made.</p>`;}catch(e){$('#room-action-message').textContent=e.message;}finally{finalizeButton.disabled=false;}};
  });
  $('#results').scrollIntoView({behavior:'smooth'});
}
document.addEventListener('click', e => {
  const button=e.target.closest('[data-profile]');
  if (!button) return;
  busy(button, async () => {
    const p=await api('/profiles/'+encodeURIComponent(button.dataset.profile));
    $('#modal-body').innerHTML=`<span class="eyebrow">MEET YOUR TRAVEL COMPANION</span><h2>${esc(p.name)}</h2>
      <p class="sub">${esc(p.home_city||'Home city not provided')}</p>
      <dl><dt>Age</dt><dd>${esc(p.age??'Not provided')}</dd>
      <dt>Gender</dt><dd>${esc(p.gender)}</dd>
      <dt>Home airport</dt><dd>${esc(p.home_airport||'Not provided')}</dd>
      <dt>Travel preference</dt><dd>${p.gender_preference==='SAME_GENDER'?'Same gender companions':'Any gender companions'}</dd></dl>
      <h3>Interests</h3><div class="chips">${p.interests.length?p.interests.map(i=>`<span class="badge">${esc(i.label)}</span>`).join(''):'<p class="sub">No interests added yet.</p>'}</div>`;
    if(!$('#modal').open) $('#modal').showModal();
  });
});

document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>{view=b.dataset.view;render();});
$('#close-modal').onclick=()=>$('#modal').close();
(async()=>{try{tags=await api('/interests');await render();}catch(e){account();renderAuth();notice('Could not load interests. Ensure PostgreSQL is running and run the schema and seed commands, then refresh. '+e.message);}})();
