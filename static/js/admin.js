let questions = [], currentFormId = null;

// Initialize
addQuestion();

function addQuestion() {
    const i = questions.length;
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
                            <option value="CO1" ${q.mapping==='CO1'?'selected':''}>CO1</option>
                            <option value="CO2" ${q.mapping==='CO2'?'selected':''}>CO2</option>
                            <option value="CO3" ${q.mapping==='CO3'?'selected':''}>CO3</option>
                            <option value="CO4" ${q.mapping==='CO4'?'selected':''}>CO4</option>
                            <option value="CO5" ${q.mapping==='CO5'?'selected':''}>CO5</option>
                            <option value="CO6" ${q.mapping==='CO6'?'selected':''}>CO6</option>
                            <option value="PO1" ${q.mapping==='PO1'?'selected':''}>PO1</option>
                            <option value="PO2" ${q.mapping==='PO2'?'selected':''}>PO2</option>
                            <option value="PO3" ${q.mapping==='PO3'?'selected':''}>PO3</option>
                            <option value="PO4" ${q.mapping==='PO4'?'selected':''}>PO4</option>
                            <option value="PO5" ${q.mapping==='PO5'?'selected':''}>PO5</option>
                            <option value="PO6" ${q.mapping==='PO6'?'selected':''}>PO6</option>
                            <option value="PO7" ${q.mapping==='PO7'?'selected':''}>PO7</option>
                            <option value="PO8" ${q.mapping==='PO8'?'selected':''}>PO8</option>
                            <option value="PO9" ${q.mapping==='PO9'?'selected':''}>PO9</option>
                            <option value="PO10" ${q.mapping==='PO10'?'selected':''}>PO10</option>
                            <option value="PO11" ${q.mapping==='PO11'?'selected':''}>PO11</option>
                            <option value="PO12" ${q.mapping==='PO12'?'selected':''}>PO12</option>
                            <option value="PSO1" ${q.mapping==='PSO1'?'selected':''}>PSO1</option>
                            <option value="PSO2" ${q.mapping==='PSO2'?'selected':''}>PSO2</option>
                            <option value="PSO3" ${q.mapping==='PSO3'?'selected':''}>PSO3</option>
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
    if(!title || !course) return alert("Title and Course Name are required");
    
    await fetch('/api/create_form', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ title, course_name: course, questions }) 
    });
    
    document.getElementById('builderModal').classList.add('hidden'); 
    loadForms();
    questions = [{ text: "", type: "rating", mapping: "CO1" }];
    document.getElementById('formTitleInput').value = "";
    document.getElementById('courseNameInput').value = "";
}

async function loadForms() {
    const res = await fetch(`/api/forms?t=${Date.now()}`); // Anti-cache
    const forms = await res.json();
    const list = document.getElementById('formsList'); 
    list.innerHTML = '';
    
    forms.forEach(f => {
        const activeClass = currentFormId === f.id ? 'border-blue-500 bg-blue-50 shadow-sm ring-1 ring-blue-500' : 'border-slate-100 bg-white hover:border-blue-200';
        list.innerHTML += `
            <div class="p-4 rounded-xl border ${activeClass} cursor-pointer transition mb-2" onclick="selectForm(${f.id}, '${f.title}', '${f.course_name}')">
                <div class="flex justify-between items-start">
                    <div>
                        <span class="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">${f.course_name}</span>
                        <span class="font-bold text-sm text-slate-800">${f.title}</span>
                    </div>
                    <span class="text-[10px] px-2 py-0.5 rounded-full ${f.is_active?'bg-green-100 text-green-700':'bg-slate-100 text-slate-500'}">${f.is_active?'Active':'Closed'}</span>
                </div>
            </div>`;
    });
}

function selectForm(id, title, course) {
    currentFormId = id; 
    document.getElementById('selectedFormTitle').innerText = `${course} : ${title}`;
    document.getElementById('analyticsHeader').classList.remove('hidden');
    loadForms(); // Refresh highlight
    loadAttainment(id);
}

async function loadAttainment(formId) {
    if(!formId) return;
    try {
        const res = await fetch(`/api/attainment?form_id=${formId}&t=${Date.now()}`);
        const data = await res.json();
        
        document.getElementById('totalStudents').innerText = data.total || 0;
        document.getElementById('avgAttendance').innerText = (data.avg_attendance || 0) + '%';
        
        const tbody = document.getElementById('attainmentTable');
        tbody.innerHTML = '';
        
        if (!data.stats || data.stats.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" class="px-6 py-8 text-center text-slate-400 italic">No ratings available yet.</td></tr>';
            return;
        }

        data.stats.forEach(row => {
            let levelColor = 'bg-red-100 text-red-700';
            if(row.level.includes('Moderate')) levelColor = 'bg-yellow-100 text-yellow-700';
            if(row.level.includes('High')) levelColor = 'bg-green-100 text-green-700';
            
            tbody.innerHTML += `
                <tr class="border-b border-slate-50 hover:bg-slate-50 transition">
                    <td class="px-6 py-4 font-mono font-bold text-blue-600">${row.code}</td>
                    <td class="px-6 py-4 font-bold text-slate-700">${row.avg} <span class="text-slate-400 font-normal">/ 5</span></td>
                    <td class="px-6 py-4 text-slate-600">${row.pct}%</td>
                    <td class="px-6 py-4"><span class="px-3 py-1 rounded-lg text-xs font-bold ${levelColor}">${row.level}</span></td>
                </tr>
            `;
        });
    } catch(e) {
        console.error("Error fetching data:", e);
    }
}

// Initial Load
loadForms();

// Auto-Refresh Loop (Every 3 seconds)
setInterval(() => {
    if (currentFormId) {
        loadAttainment(currentFormId);
    }
}, 3000);