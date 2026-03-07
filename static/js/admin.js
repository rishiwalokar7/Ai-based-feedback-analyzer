let questions = [], currentFormId = null;
let openDropdowns = new Set(); // FIXED: Keeps track of which dropdowns are open

// Hardcoded Dictionary of College Specific COs
const COURSE_DATA = {
    "Theory of Computation": ["CO1: Design the Finite State Machine with mathematical representation.", "CO2: Define regular expression for the given Finite State Machine and vice versa.", "CO3: Represent context free grammar in various forms along with its properties.", "CO4: Design Push Down Automaton and Turing Machine as FSM and its various representation.", "CO5: Differentiate between decidable and undecidable problems."],
    "Software Engineering and Project Management": ["CO1: Distinguish and apply software development techniques to the different kinds of project.", "CO2: Understand role of software engineer, analyze project requirements and author a formal specification for a software system.", "CO3: Apply design process, steps for effective UI design depending on the requirement of the project.", "CO4: Design test cases, apply testing strategies and demonstrate the ability to plan, estimate project.", "CO5: Demonstrate the ability to work on software project by taking into consideration software quality factors."],
    "Software Engineering & Project Management Lab": ["CO1: Elicit and analyze project requirements, and author a formal specification for a software system.", "CO2: Demonstrate the ability to plan, estimate and schedule project.", "CO3: Apply design process depending on the requirement of the project.", "CO4: Design test cases and apply testing strategies in software development."],
    "Operating System": ["CO1: Understand the basics of how operating systems work.", "CO2: Explain how processes and CPU scheduling function in an operating system.", "CO3: Solve common process synchronization problems.", "CO4: Describe memory management concepts, including virtual memory.", "CO5: Comprehend disk management and the role of file systems in an operating system."],
    "Operating System Lab": ["CO1: Understand and implement basic services and functionalities of the operating system using system calls.", "CO2: Analyze and simulate CPU Scheduling Algorithms like FCFS, Round Robin, SJF, and Priority.", "CO3: Implement memory management schemes and page replacement schemes.", "CO4: Implement synchronization mechanisms to address concurrent access issues.", "CO5: Understand the concepts of deadlock in operating systems and implement them in multi programming system."],
    "Computer Graphics (PE-I)": ["CO1: Demonstrate the working of line drawing and circle drawing algorithm", "CO2: Demonstrate 2D transformations and polygon clipping algorithms.", "CO3: Demonstrate 3D transformations and curves & surfaces.", "CO4: Realize different color models", "CO5: Demonstrate advanced algorithms based on hidden lines and surfaces."],
    "PE-I Artificial Intelligence": ["CO1: Understand the AI and AI Problem.", "CO2: Analyze the data using predicate logic knowledge", "CO3: Solve the problem using Bayes and DST Probabilistic Reasoning", "CO4: Apply Natural Language Processing kit on given sentence", "CO5: Recall and understand the concept of Expert System."],
    "Computer Lab - II": ["CO1: Explore and implement the competitive programming concepts of advanced programming.", "CO2: Solve Industry placement problems based on competitive programming."],
    "OE-II Object Oriented Programming": ["CO1: Analyze and think in terms of object oriented paradigm during development of application.", "CO2: Apply the concept object initialization and destroy using constructors and destructors.", "CO3: Develop application using the concept of inheritance and evaluate the usefulness.", "CO4: Apply concept polymorphism to implement static and runtime binding.", "CO5: Realize the concept of abstract class, use exception handling technique in program."],
    "Technical Skill Development-II": ["CO1: Use compiler Java and eclipse or notepad to write and execute java program.", "CO2: Understand and apply the concept of object-oriented features and Java concept.", "CO3: Apply the concept of multithreaded and implement exception handling.", "CO4: Develop an application using JDBC."],
    "MDM-III Introduction to Business Management": ["CO1: Understand the principles and functions of management.", "CO2: Apply planning and organizing tools to real-world situations.", "CO3: Analyze leadership styles and motivation theories in workplace contexts.", "CO4: Demonstrate basic understanding of marketing, HR, and financial functions.", "CO5: Evaluate the role of entrepreneurship and business environment in economic development."],
    "Career Development - V": ["CO1: Engage in career development planning and assessment."],
    "Events": [], "Others": []
};

const PO_LIST_FULL = ["PO1: Engineering Knowledge", "PO2: Problem Analysis", "PO3: Design & Development", "PO4: Conduct Investigations", "PO5: Modern Tools", "PO6: Engineer & Society", "PO7: Environment", "PO8: Ethics", "PO9: Individual & Team Work", "PO10: Communication Skills", "PO11: Project Management", "PO12: Life Long Learning"];
const PSO_LIST_FULL = ["PSO1: Analyze, design & develop...", "PSO2: Deal with problems...", "PSO3: Model software solutions..."];
const PEO_LIST_FULL = ["PEO1", "PEO2", "PEO3"];

// Initialize
addQuestion();

function addQuestion() {
    questions.push({ text: "", type: "rating_3", mappings: [] });
    renderBuilder();
}

window.handleCourseChange = function() {
    const courseName = document.getElementById('courseNameInput').value;
    const courseCOs = COURSE_DATA[courseName] || [];
    const maxCo = courseCOs.length > 0 ? courseCOs.length : 6;
    
    questions.forEach(q => {
        if (q.mappings) {
            q.mappings = q.mappings.filter(m => {
                if (m.startsWith('CO')) {
                    const num = parseInt(m.replace('CO', ''));
                    return num <= maxCo;
                }
                return true;
            });
        }
    });
    renderBuilder();
}

// FIXED DROPDOWN LOGIC
window.toggleDropdown = function(id) {
    if (openDropdowns.has(id)) openDropdowns.delete(id);
    else openDropdowns.add(id);
    renderBuilder();
}

window.toggleMap = function(qIdx, mapKey) {
    const q = questions[qIdx];
    if (!q.mappings) q.mappings = [];
    const idx = q.mappings.indexOf(mapKey);
    if (idx > -1) q.mappings.splice(idx, 1);
    else q.mappings.push(mapKey);
    // Keeps dropdown open because openDropdowns set is preserved
    renderBuilder(); 
}

function getDropdownHtml(qIdx, type, list, currentMappings) {
    const dropId = `${qIdx}_${type}`;
    const isOpen = openDropdowns.has(dropId);
    const selectedCount = currentMappings.filter(m => m.startsWith(type)).length;
    const btnText = selectedCount > 0 ? `${type} (${selectedCount})` : `Select ${type}`;

    let optionsHtml = list.map((item) => {
        const key = item.split(':')[0].trim();
        const isChecked = currentMappings.includes(key) ? 'checked' : '';
        return `
            <label class="flex items-start gap-2 p-2 hover:bg-blue-50 cursor-pointer text-[11px] text-slate-700 transition border-b border-slate-50 last:border-0" onclick="event.stopPropagation();">
                <input type="checkbox" class="mt-0.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer" ${isChecked} onchange="toggleMap(${qIdx}, '${key}')">
                <span class="leading-tight">${item}</span>
            </label>
        `;
    }).join('');

    // Accordion Style Dropdown (Doesn't get cut off by overflow)
    return `
        <div class="flex-1 min-w-[140px] border border-slate-200 rounded-lg bg-white shadow-sm flex flex-col transition-all">
            <button type="button" onclick="toggleDropdown('${dropId}')" class="w-full px-3 py-2 ${selectedCount > 0 ? 'bg-blue-50 text-blue-700' : 'bg-slate-50 text-slate-600'} hover:bg-blue-100 text-xs font-bold flex justify-between items-center transition rounded-lg">
                <span>${btnText}</span>
                <i class="ph-bold ph-caret-down ${isOpen ? 'rotate-180' : ''} transition-transform"></i>
            </button>
            <div class="${isOpen ? 'block' : 'hidden'} bg-white border-t border-slate-100 max-h-40 overflow-y-auto custom-scrollbar rounded-b-lg">
                ${optionsHtml}
            </div>
        </div>
    `;
}

function renderBuilder() {
    const c = document.getElementById('questionsContainer'); 
    c.innerHTML = '';
    
    const courseName = document.getElementById('courseNameInput').value;
    const courseCOs = (courseName && COURSE_DATA[courseName]) ? COURSE_DATA[courseName] : [];
    const dynamicCoList = courseCOs.length > 0 ? courseCOs : ["CO1", "CO2", "CO3", "CO4", "CO5", "CO6"];

    questions.forEach((q, i) => {
        const mappings = q.mappings || [];
        const activePills = mappings.map(m => `<span class="px-1.5 py-0.5 bg-blue-100 text-blue-700 border border-blue-200 rounded text-[10px] font-bold shadow-sm">${m}</span>`).join(' ');

        c.innerHTML += `
            <div class="flex flex-col gap-3 bg-white p-4 rounded-xl border border-slate-200 relative shadow-sm">
                <button onclick="removeQ(${i})" class="absolute top-2 right-2 text-slate-300 hover:text-red-500 font-bold w-6 h-6 flex items-center justify-center rounded-full hover:bg-red-50 transition">&times;</button>
                
                <div class="flex gap-3">
                    <input class="flex-1 p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:border-blue-500 transition focus:bg-white" placeholder="Enter Question to be asked..." value="${q.text}" onchange="updateQ(${i}, 'text', this.value)">
                    <select class="w-48 p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold text-slate-700 outline-none focus:border-blue-500 transition focus:bg-white" onchange="updateQ(${i}, 'type', this.value)">
                        <option value="rating_3" ${q.type==='rating_3'?'selected':''}>Rating (1, 2, 3)</option>
                        <option value="rating_5" ${q.type==='rating_5'?'selected':''}>Rating (1 to 5)</option>
                        <option value="text" ${q.type==='text'?'selected':''}>Text Comment</option>
                    </select>
                </div>
                
                <div class="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-3">
                    <div class="flex justify-between items-center min-h-[24px]">
                        <span class="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Outcome Mapping:</span>
                        <div class="flex flex-wrap gap-1">${activePills}</div>
                    </div>
                    
                    <div class="flex flex-wrap gap-2 items-start">
                        ${getDropdownHtml(i, 'CO', dynamicCoList, mappings)}
                        ${getDropdownHtml(i, 'PO', PO_LIST_FULL, mappings)}
                        ${getDropdownHtml(i, 'PSO', PSO_LIST_FULL, mappings)}
                        ${getDropdownHtml(i, 'PEO', PEO_LIST_FULL, mappings)}
                    </div>
                </div>
            </div>`;
    });
}

function updateQ(i, k, v) { questions[i][k] = v; }
function removeQ(i) { questions.splice(i, 1); renderBuilder(); }

async function saveForm() {
    const title = document.getElementById('formTitleInput').value;
    const course = document.getElementById('courseNameInput').value;
    if(!title || !course) return alert("Event Title and Course Name are required");
    
    await fetch('/api/create_form', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title, course_name: course, questions }) });
    document.getElementById('builderModal').classList.add('hidden'); 
    
    // Reset form after saving
    openDropdowns.clear(); 
    questions = [{ text: "", type: "rating_3", mappings: [] }];
    document.getElementById('formTitleInput').value = ""; document.getElementById('courseNameInput').value = "";
    
    loadForms();
}

async function loadForms() {
    const res = await fetch(`/api/forms?t=${Date.now()}`);
    const forms = await res.json();
    const list = document.getElementById('formsList'); list.innerHTML = '';
    forms.forEach(f => {
        const activeClass = currentFormId === f.id ? 'border-blue-500 bg-blue-50 shadow-sm ring-1 ring-blue-500' : 'border-slate-100 bg-white hover:border-blue-200';
        list.innerHTML += `<div class="p-4 rounded-xl border ${activeClass} cursor-pointer transition mb-2" onclick="selectForm(${f.id}, '${f.title}', '${f.course_name}')"><div class="flex justify-between items-start"><div><span class="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">${f.course_name}</span><span class="font-bold text-sm text-slate-800">${f.title}</span></div><span class="text-[10px] px-2 py-0.5 rounded-full ${f.is_active?'bg-green-100 text-green-700':'bg-slate-100 text-slate-500'}">${f.is_active?'Active':'Closed'}</span></div></div>`;
    });
}

function selectForm(id, title, course) {
    currentFormId = id; 
    document.getElementById('selectedFormTitle').innerText = course;
    document.getElementById('selectedEventTitle').innerText = title;
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
        else data.stats.forEach(r => tbody.innerHTML += `<tr class="border-b border-slate-50"><td class="px-6 py-4 font-mono font-bold text-blue-600">${r.code}</td><td class="px-6 py-4 text-slate-500"><i class="ph-fill ph-crosshair mr-1"></i> ${r.student_count} Eval Pts</td><td class="px-6 py-4 font-bold text-slate-800">${r.avg}</td><td class="px-6 py-4">${r.pct}%</td><td class="px-6 py-4"><span class="px-3 py-1 rounded text-xs font-bold ${r.color}">${r.level}</span></td></tr>`);

        // 2. QUESTION TABLE
        const qbody = document.getElementById('questionTable'); qbody.innerHTML = '';
        if (data.question_stats.length === 0) qbody.innerHTML = '<tr><td colspan="4" class="px-6 py-8 text-center text-slate-400">No questions.</td></tr>';
        else data.question_stats.forEach((q, i) => {
            let scoreHtml = q.type.startsWith('rating')
                ? `<span class="font-bold text-slate-800">${q.avg}</span> <span class="text-slate-400 text-xs ml-1">(${q.pct}% Attainment)</span>`
                : `<span class="text-slate-500 text-xs font-medium">${q.count} Written Comments</span>`;
            
            let mapPills = q.mappings.map(m => `<span class="px-1.5 py-0.5 bg-slate-100 border border-slate-200 rounded text-[10px] text-slate-600">${m}</span>`).join(' ');
            if(!mapPills) mapPills = `<span class="text-xs text-slate-400 italic">None</span>`;

            qbody.innerHTML += `<tr class="border-b border-slate-50 hover:bg-slate-50"><td class="px-6 py-4 font-medium text-slate-700">${i+1}. ${q.text}</td><td class="px-6 py-4 font-mono flex flex-wrap gap-1">${mapPills}</td><td class="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">${q.type.replace('_', ' ')}</td><td class="px-6 py-4">${scoreHtml}</td></tr>`;
        });

        // 3. SENTIMENT FEED
        const list = document.getElementById('responsesList'); list.innerHTML = '';
        if (data.responses.length === 0) list.innerHTML = '<p class="text-center text-slate-400 text-sm mt-10">No feedback yet.</p>';
        data.responses.forEach(r => {
            let qa = JSON.parse(r.answers_json).map(a => `<div class="truncate text-xs mt-1"><span class="font-bold text-slate-700">${a.question}:</span> <span class="text-slate-600">${a.answer}</span></div>`).join('');
            let color = r.sentiment_label==='Positive'?'text-green-600 bg-green-50':r.sentiment_label==='Negative'?'text-red-600 bg-red-50':'text-slate-500 bg-slate-50';
            list.innerHTML += `<div class="p-3 bg-white border border-slate-100 rounded-xl mb-2"><div class="flex justify-between mb-1"><div class="font-bold text-sm">${r.student_name}</div><span class="text-[10px] font-bold px-2 py-0.5 rounded uppercase ${color}">${r.sentiment_label}</span></div>${qa}</div>`;
        });
        
        if (data.sentiment) {
            let maxSent = "Neutral 😐";
            if (data.sentiment.pos > data.sentiment.neu && data.sentiment.pos > data.sentiment.neg) maxSent = "Positive 😊";
            else if (data.sentiment.neg > data.sentiment.neu && data.sentiment.neg > data.sentiment.pos) maxSent = "Negative 😞";
            document.getElementById('classSentiment').innerText = maxSent;
        }

    } catch(e) { console.error("Error fetching data:", e); }
}

loadForms();
setInterval(() => { if (currentFormId) loadAttainment(currentFormId); }, 3000);