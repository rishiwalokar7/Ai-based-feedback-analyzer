let questions = [], currentFormId = null;

function addQuestion() { questions.push({ text: "", type: "text" }); renderBuilder(); }
function renderBuilder() {
    const c = document.getElementById('questionsContainer'); c.innerHTML = '';
    questions.forEach((q, i) => {
        c.innerHTML += `
            <div class="flex gap-2 mb-2">
                <input class="flex-1 p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 outline-none text-sm" placeholder="Question" onchange="updateQ(${i}, 'text', this.value)" value="${q.text}">
                <select class="p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-600 outline-none text-xs" onchange="updateQ(${i}, 'type', this.value)">
                    <option value="text" ${q.type==='text'?'selected':''}>Text</option>
                    <option value="rating" ${q.type==='rating'?'selected':''}>Rating</option>
                    <option value="long_text" ${q.type==='long_text'?'selected':''}>Long Text</option>
                    <option value="file" ${q.type==='file'?'selected':''}>File Upload</option>
                </select>
                <button onclick="removeQ(${i})" class="text-red-400 hover:text-red-600 px-2 transition">&times;</button>
            </div>`;
    });
}
function updateQ(i, k, v) { questions[i][k] = v; }
function removeQ(i) { questions.splice(i, 1); renderBuilder(); }

async function saveForm() {
    const title = document.getElementById('formTitleInput').value; if(!title) return;
    await fetch('/api/create_form', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title, questions }) });
    document.getElementById('builderModal').classList.add('hidden'); document.getElementById('formTitleInput').value=''; questions=[]; renderBuilder(); loadForms();
}

async function loadForms() {
    const res = await fetch('/api/forms'); const forms = await res.json();
    const list = document.getElementById('formsList'); list.innerHTML = '';
    forms.forEach(f => {
        list.innerHTML += `<div class="p-4 rounded-xl border ${currentFormId==f.id?'border-blue-500 bg-blue-50':'border-slate-100 bg-white hover:border-slate-300'} cursor-pointer transition shadow-sm group" onclick="selectForm(${f.id}, '${f.title}')"><div class="flex justify-between items-center"><span class="font-bold text-sm text-slate-800 ${currentFormId==f.id?'text-blue-700':''}">${f.title}</span><span class="text-[10px] px-2 py-0.5 rounded-full ${f.is_active?'bg-green-100 text-green-700':'bg-slate-100 text-slate-500'}">${f.is_active?'Active':'Closed'}</span></div><button onclick="event.stopPropagation(); toggleForm(${f.id}, ${f.is_active?0:1})" class="text-xs text-slate-400 underline mt-2 hover:text-blue-600 opacity-0 group-hover:opacity-100 transition">${f.is_active?'Close':'Re-open'}</button></div>`;
    });
}

async function toggleForm(id, status) { await fetch('/api/toggle_form', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, status }) }); loadForms(); }

function selectForm(id, title) {
    currentFormId = id; document.getElementById('selectedFormTitle').innerText = title;
    document.getElementById('analyticsHeader').classList.remove('hidden');
    document.getElementById('downloadCsvBtn').href = `/api/export_csv?form_id=${id}`;
    document.getElementById('downloadPdfBtn').href = `/api/export_pdf?form_id=${id}`;
    loadForms(); loadResponses(id);
}

async function generateAIReport() {
    if(!currentFormId) return;
    document.getElementById('aiModal').classList.remove('hidden');
    document.getElementById('aiReportContent').innerHTML = '<div class="flex items-center justify-center py-10"><div class="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div></div>';
    try {
        const res = await fetch('/api/ai/report', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ form_id: currentFormId }) });
        const data = await res.json();
        const formatted = data.report.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>');
        document.getElementById('aiReportContent').innerHTML = formatted;
    } catch(e) { document.getElementById('aiReportContent').innerHTML = '<p class="text-red-500">Failed to generate report.</p>'; }
}

const pieCtx = document.getElementById('pieChart').getContext('2d');
const barCtx = document.getElementById('barChart').getContext('2d');
const lineCtx = document.getElementById('lineChart').getContext('2d');
let pieChart = new Chart(pieCtx, { type: 'doughnut', data: { labels: ['Pos','Neu','Neg'], datasets: [{ data: [0,0,0], backgroundColor: ['#22c55e','#94a3b8','#ef4444'], borderWidth: 2, borderColor: '#ffffff' }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { usePointStyle: true, boxWidth: 6 } } } } });
let barChart = new Chart(barCtx, { type: 'bar', data: { labels: ['1','2','3','4','5'], datasets: [{ data: [0,0,0,0,0], backgroundColor: '#3b82f6', borderRadius: 4 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, scales: { y: { display: false }, x: { grid: { display: false } } } } } });
let lineChart = new Chart(lineCtx, { type: 'line', data: { labels: [], datasets: [{ data: [], borderColor: '#8b5cf6', tension: 0.4, pointRadius: 0, borderWidth: 2 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, scales: { y: { display: false }, x: { display: false } } } } });

async function loadResponses(formId=null) {
    currentFormId = formId; if(!formId) return;
    const res = await fetch(`/api/history?form_id=${formId}`);
    if(res.status===401) { window.location.href='/login'; return; }
    const json = await res.json(); const data = json.responses;
    const list = document.getElementById('responsesList'); list.innerHTML = '';
    let pos=0, neu=0, neg=0, stars=[0,0,0,0,0], timeline=[];
    
    if(data.length === 0) list.innerHTML = '<p class="text-center text-slate-400 text-sm py-10 italic">No responses yet.</p>';

    data.forEach(r => {
        if(r.sentiment_label==='Positive') pos++; else if(r.sentiment_label==='Negative') neg++; else neu++;
        r.answers.forEach(a => { if(a.type==='rating' && a.answer) stars[parseInt(a.answer)-1]++; });
        timeline.push(r.sentiment_score);
        let qa = r.answers.map(a => `<div class="truncate"><span class="font-bold mr-1 text-slate-700">${a.question}:</span><span class="text-slate-600">${a.answer}</span></div>`).join('');
        
        let icon = r.channel === 'Email' ? '<i class="ph-bold ph-envelope-simple text-slate-400"></i>' : '<i class="ph-bold ph-globe text-slate-400"></i>';
        
        list.innerHTML += `<div class="p-4 bg-white border border-slate-100 rounded-xl hover:shadow-md transition text-sm"><div class="flex justify-between mb-2"><div class="flex items-center gap-2">${icon}<span class="font-bold text-slate-800">${r.student_name}</span></div><span class="text-[10px] font-bold px-2 py-0.5 rounded uppercase ${r.sentiment_label==='Positive'?'bg-green-50 text-green-600':r.sentiment_label==='Negative'?'bg-red-50 text-red-600':'bg-slate-50 text-slate-500'}">${r.sentiment_label}</span></div>${qa}</div>`;
    });
    document.getElementById('totalCount').innerText=data.length; document.getElementById('posCount').innerText=pos; document.getElementById('neuCount').innerText=neu; document.getElementById('negCount').innerText=neg;
    pieChart.data.datasets[0].data=[pos,neu,neg]; pieChart.update();
    barChart.data.datasets[0].data=stars; barChart.update();
    lineChart.data.labels=data.map((_,i)=>i); lineChart.data.datasets[0].data=timeline; lineChart.update();
}

addQuestion(); loadForms(); loadResponses(); setInterval(() => loadResponses(currentFormId), 5000);