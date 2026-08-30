const courses=[['Computer Architecture',6,'24.3 MB','3w'],['Embedded System',7,'47.4 MB','1mo'],['Research Method and IT Project',1,'0 B','1mo'],['Financial Accounting',5,'7.8 MB','1mo'],['Data Structures II',11,'49.9 MB','2w'],['Computer Graphics',4,'27.7 MB','2w'],['E-Commerce',20,'30.7 MB','1w'],['Operations Research II',4,'2.6 MB','2w']];
const uploads=[['Porters five forces Model - CSM 358 - 2025.pdf','E-Commerce · 1w ago'],['laudon_ecom8_pp_05GE.ppt','E-Commerce · 1w ago'],['laudon_ecom8_pp_02GE.ppt','E-Commerce · 1w ago'],['competing with information - FORCES MODEL.pdf','E-Commerce · 1w ago'],['lecture-13.doc','E-Commerce · 1w ago']];
const exams=[['Monday 17 August','Computer Architecture','Computer Labs','12:00 PM–2:00 PM'],['Wednesday 19 August','Computer Graphics','SF1/SF7/SF8/SF19/SF20/TF1/TF34','8:30 AM–10:30 AM'],['Friday 21 August','E-Commerce','SF1/SF7/SF8/SF19/SF20/TF1/TF34','8:30 AM–10:30 AM'],['Monday 24 August','Data Structures II','SF1/SF7/SF8/SF19/SF20/TF1/TF34','3:30 PM–5:30 PM']];
const groups=[['Computer Architecture','Group 12','27 members · Ahaze (leader)'],['Embedded System','Group 11','7 members · Agyeman (leader)']];
const quizzes=[['◈','Computer Architecture','12 questions · 15 minutes'],['◇','Data Structures II','10 questions · 12 minutes'],['▦','Financial Accounting','15 questions · 20 minutes'],['◎','Computer Graphics','8 questions · 10 minutes'],['△','E-Commerce','10 questions · 15 minutes'],['□','Embedded System','12 questions · 18 minutes']];

const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
function render(){
  $('#groups').innerHTML=groups.map(g=>`<article class="card group-card"><i class="dot blue-bg"></i><div><strong>${g[0].toUpperCase()}</strong><b>${g[1]}</b><small>${g[2]}</small></div><span class="pill">Group 1</span><span>›</span></article>`).join('');
  $('#course-grid').innerHTML=courses.map(c=>`<article class="card course-card" data-name="${c[0].toLowerCase()}"><h3>${c[0]}</h3><div class="course-meta"><span class="file-pill">${c[1]} ${c[1]===1?'file':'files'}</span>${c[2]} · updated ${c[3]} ago</div></article>`).join('');
  $('#uploads').innerHTML=uploads.map(u=>`<div class="upload"><span>${u[0]}</span><small>${u[1]}</small></div>`).join('');
  $('#schedule').innerHTML=exams.map(e=>`<div class="schedule-day"><h3>${e[0]}</h3><article class="card exam-card"><div><h3>${e[1]}</h3><p>⌖ ${e[2]}</p></div><time>${e[3]}</time></article></div>`).join('');
  $('#quiz-grid').innerHTML=quizzes.map(q=>`<article class="card quiz-card"><div class="quiz-icon blue">${q[0]}</div><h3>${q[1]}</h3><p>${q[2]}</p><button class="primary quiz-start">Start quiz</button></article>`).join('');
}
function route(){const id=(location.hash||'#home').slice(1);const valid=['home','resources','quizzes','request','timetable'];const page=valid.includes(id)?id:'home';$$('.page').forEach(x=>x.classList.toggle('active',x.id===page));$$('[data-page]').forEach(x=>x.classList.toggle('active',x.dataset.page===page));window.scrollTo(0,0)}
function toast(msg){const t=$('#toast');t.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2200)}
render();route();addEventListener('hashchange',route);
$('#course-search').addEventListener('input',e=>{$$('.course-card').forEach(c=>c.hidden=!c.dataset.name.includes(e.target.value.toLowerCase()))});
$('#send-request').addEventListener('click',()=>{$('#request-status').textContent='Request sent — waiting for your class rep.';toast('Your request has been sent')});
$$('.quiz-start').forEach(b=>b.addEventListener('click',()=>toast('Quiz will open here')));
$$('.tabs button').forEach(b=>b.addEventListener('click',()=>{$$('.tabs button').forEach(x=>x.classList.remove('active'));b.classList.add('active');toast(b.textContent==='Get help'?'Help form selected':'Join form selected')}));
