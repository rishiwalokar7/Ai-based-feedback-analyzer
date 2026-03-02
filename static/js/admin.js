let questions = [], currentFormId = null;

addQuestion();

function addQuestion() {
    questions.push({ text: "", type: "rating", mapping: "CO1" });
    renderBuilder();
}

function renderBuilder() {
    const c = document.getElementById('questionsContainer'); 
    c.innerHTML = '';
    questions.forEach((q, i) => {
        c.innerHTML += `
            <div class="flex gap-2 items-start bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div class="flex-1 space-y-2">
                    <input class="w-full p-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:border-blue-500" placeholder="Question Text" value="${q.text}" onchange="updateQ(${i}, 'text', this.value)">
                    <div class="flex gap-2">
                        <select class="w-1/3 p-2 bg-white border border-slate-200 rounded-lg text-xs outline-none" onchange="updateQ(${i}, 'type', this.value)">
                            <option value="rating" ${q.type==='rating'?'selected':''}>Rating (1-5)</option>
                            <option value="text" ${q.type==='text'?'selected':''}>Comment</option>
                        </select>
                        <select class="w-2/3 p-2 bg-white border border-slate-200 rounded-lg text-xs font-mono outline-none" onchange="updateQ(${i}, 'mapping', this.value)">
                            <option value="CO1" ${q.mapping==='CO1'?'selected':''}>CO1</option><option value="CO2" ${q.mapping==='CO2'?'selected':''}>CO2</option><option value="CO3" ${q.mapping==='CO3'?'selected':''}>CO3</option><option value="CO4" ${q.mapping==='CO4'?'selected':''}>CO4</option><option value="CO5" ${q.mapping==='CO5'?'selected':''}>CO5</option><option value="CO6" ${q.mapping==='CO6'?'selected':''}>CO6</option><option value="PO1" ${q.mapping==='PO1'?'selected':''}>PO1</option><option value="PO2" ${q.mapping==='PO2'?'selected':''}>PO2</option><option value="PO3" ${q.mapping==='PO3'?'selected':''}>PO3</option><option value="PO4" ${q.mapping==='PO4'?'selected':''}>PO4</option><option value="PO5" ${q.mapping==='PO5'?'selected':''}>PO5</option><option value="PO6" ${q.mapping==='PO6'?'selected':''}>PO6</option><option value="PO7" ${q.mapping==='PO7'?'selected':''}>PO7</option><option value="PO8" ${q.mapping==='PO8'?'selected':''}>PO8</option><option value="PO9" ${q.mapping==='PO9'?'selected':''}>PO9</option><option value="PO10" ${q.mapping==='PO10'?'selected':''}>PO10</option><option value="PO11" ${q.mapping==='PO11'?'selected':''}>PO11</option><option value="PO12" ${q.mapping==='PO12'?'selected':''}>PO12</option><option value="PSO1" ${q.mapping==='PSO1'?'selected':''}>PSO1</option><option value="PSO2" ${q.mapping==='PSO2'?'selected':''}>PSO2</option><option value="PSO3" ${q.mapping==='PSO3'?'selected':''}>PSO3</option>
                        </select>
                    </div>
                </div>
                <button onclick="removeQ(${i})" class="text-red-400 hover:text-red-600 p-1 font-bold">&times;</button>
            </div>`;
    });
}
function updateQ(i, k, v) { questions[i][k] = v; }
function removeQ(i) { questions.splice(i, 1); renderBuilder(); }

async function saveForm() {
    const title = document.getElementById('formTitleInput').value;
    const course = document.getElementById('courseNameInput').value;
    if(!title || !course) return alert("Title and Course are required");
    await fetch('/api/create_form', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title, course_name: course, questions }) });
    document.getElementById('builderModal').classList.add('hidden'); 
    loadForms();
    questions = [{ text: "", type: "rating", mapping: "CO1" }];
    document.getElementById('formTitleInput').value = ""; document.getElementById('courseNameInput').value = "";
}

async function loadForms() {
    const res = await fetch(`/api/forms?t=${Date.now()}`);
    const forms = await res.json();
    const list = document.getElementById('formsList'); list.innerHTML = '';
    forms.forEach(f => {
        const activeClass = currentFormId === f.id ? 'border-blue-500 bg-blue-50 shadow-sm' : 'border-slate-100 bg-white hover:border-blue-200';
        list.innerHTML += `<div class="p-4 rounded-xl border ${activeClass} cursor-pointer transition mb-2" onclick="selectForm(${f.id}, '${f.title}', '${f.course_name}')"><div class="flex justify-between items-start"><div><span class="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">${f.course_name}</span><span class="font-bold text-sm text-slate-800">${f.title}</span></div><span class="text-[10px] px-2 py-0.5 rounded-full ${f.is_active?'bg-green-100 text-green-700':'bg-slate-100 text-slate-500'}">${f.is_active?'Active':'Closed'}</span></div></div>`;
    });
}

function selectForm(id, title, course) {
    currentFormId = id; 
    document.getElementById('selectedFormTitle').innerText = `${course} - ${title}`;
    document.getElementById('analyticsHeader').classList.remove('hidden');
    document.getElementById('downloadPdfBtn').href = `/api/export_pdf?form_id=${id}`;
    document.getElementById('downloadCsvBtn').href = `/api/export_csv?form_id=${id}`;
    loadForms(); loadAttainment(id);
}

// Chart Initializations
const pieCtx = document.getElementById('pieChart').getContext('2d');
const barCtx = document.getElementById('barChart').getContext('2d');
const lineCtx = document.getElementById('lineChart').getContext('2d');
let pieChart = new Chart(pieCtx, { type: 'doughnut', data: { labels: ['Pos','Neu','Neg'], datasets: [{ data: [0,0,0], backgroundColor: ['#22c55e','#94a3b8','#ef4444'] }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right' } } } });
let barChart = new Chart(barCtx, { type: 'bar', data: { labels: ['1','2','3','4','5'], datasets: [{ data: [0,0,0,0,0], backgroundColor: '#3b82f6', borderRadius: 4 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } } });
let lineChart = new Chart(lineCtx, { type: 'line', data: { labels: [], datasets: [{ data: [], borderColor: '#8b5cf6', tension: 0.4 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } } });

async function loadAttainment(formId) {
    if(!formId) return;
    try {
        const res = await fetch(`/api/attainment?form_id=${formId}&t=${Date.now()}`);
        const data = await res.json();
        
        document.getElementById('totalStudents').innerText = data.total || 0;
        
        // 1. OBE TABLE
        const tbody = document.getElementById('attainmentTable'); tbody.innerHTML = '';
        if (data.stats.length === 0) tbody.innerHTML = '<tr><td colspan="5" class="px-6 py-8 text-center text-slate-400">No data.</td></tr>';
        else data.stats.forEach(r => tbody.innerHTML += `<tr class="border-b border-slate-50"><td class="px-6 py-4 font-mono font-bold text-blue-600">${r.code}</td><td class="px-6 py-4 text-slate-500">${r.student_count}</td><td class="px-6 py-4 font-bold">${r.avg}</td><td class="px-6 py-4">${r.pct}%</td><td class="px-6 py-4"><span class="px-3 py-1 rounded text-xs font-bold ${r.color}">${r.level}</span></td></tr>`);

        // 2. QUESTION TABLE
        const qbody = document.getElementById('questionTable'); qbody.innerHTML = '';
        if (data.question_stats.length === 0) qbody.innerHTML = '<tr><td colspan="4" class="px-6 py-8 text-center text-slate-400">No questions.</td></tr>';
        else data.question_stats.forEach((q, i) => qbody.innerHTML += `<tr class="border-b border-slate-50"><td class="px-6 py-4 font-medium text-slate-700">${i+1}. ${q.text}</td><td class="px-6 py-4"><span class="bg-slate-100 text-slate-600 px-2 py-1 rounded text-xs font-mono font-bold">${q.mapping}</span></td><td class="px-6 py-4 text-xs font-bold text-slate-400 uppercase">${q.type}</td><td class="px-6 py-4">${q.type==='rating'?`<b>${q.avg}</b> <span class="text-xs text-slate-400">/ 5</span>`:`<span class="text-xs text-slate-500">${q.count} Comments</span>`}</td></tr>`);

        // 3. CHARTS & SENTIMENT
        if(data.sentiment) {
            pieChart.data.datasets[0].data = [data.sentiment.pos, data.sentiment.neu, data.sentiment.neg]; pieChart.update();
            barChart.data.datasets[0].data = data.sentiment.stars; barChart.update();
            lineChart.data.labels = data.sentiment.timeline.map((_,i)=>i); lineChart.data.datasets[0].data = data.sentiment.timeline; lineChart.update();
            
            // Set Overall Sentiment Text
            let maxSent = "Neutral";
            if (data.sentiment.pos > data.sentiment.neu && data.sentiment.pos > data.sentiment.neg) maxSent = "Positive 😊";
            else if (data.sentiment.neg > data.sentiment.neu && data.sentiment.neg > data.sentiment.pos) maxSent = "Negative 😞";
            document.getElementById('classSentiment').innerText = maxSent;
        }

        // 4. FEED
        const list = document.getElementById('responsesList'); list.innerHTML = '';
        if (data.responses.length === 0) list.innerHTML = '<p class="text-center text-slate-400 text-sm mt-10">No feedback yet.</p>';
        data.responses.forEach(r => {
            let qa = JSON.parse(r.answers_json).map(a => `<div class="truncate text-xs"><span class="font-bold text-slate-700">${a.question}:</span> <span class="text-slate-600">${a.answer}</span></div>`).join('');
            let color = r.sentiment_label==='Positive'?'text-green-600 bg-green-50':r.sentiment_label==='Negative'?'text-red-600 bg-red-50':'text-slate-500 bg-slate-50';
            list.innerHTML += `<div class="p-3 bg-white border border-slate-100 rounded-xl mb-2"><div class="flex justify-between mb-1"><div class="font-bold text-sm">${r.student_name}</div><span class="text-[10px] font-bold px-2 py-0.5 rounded uppercase ${color}">${r.sentiment_label}</span></div>${qa}</div>`;
        });

    } catch(e) { console.error("Error fetching data:", e); }
}

loadForms();
setInterval(() => { if (currentFormId) loadAttainment(currentFormId); }, 3000);