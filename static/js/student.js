let globalForms = [], currentStructure = [];

async function init() {
    try {
        const res = await fetch('/api/forms?active_only=true');
        globalForms = await res.json();
        const sel = document.getElementById('formSelect');
        sel.innerHTML = '<option value="" disabled selected>Select Course...</option>';
        if (globalForms.length === 0) sel.innerHTML = '<option disabled>No active courses found.</option>';
        globalForms.forEach((f, i) => { const o = document.createElement('option'); o.value = i; o.text = `${f.course_name} : ${f.title}`; sel.appendChild(o); });
    } catch (e) { console.error("Error:", e); }
}

function renderForm() {
    const sel = document.getElementById('formSelect');
    if (!sel.value) return; 
    const form = globalForms[sel.value];
    currentStructure = form.structure;
    document.getElementById('selectorCard').classList.add('hidden');
    document.getElementById('formCard').classList.remove('hidden');
    document.getElementById('dynamicTitle').innerText = form.course_name;
    const con = document.getElementById('questionsArea'); con.innerHTML = '';
    
    currentStructure.forEach((q, i) => {
        let inp = '';
        if (q.type === 'text') inp = `<input type="text" name="q_${i}" class="w-full p-4 bg-white border border-slate-200 rounded-xl outline-none focus:border-blue-500 transition" required placeholder="Comment...">`;
        else if (q.type === 'rating') inp = `<div class="flex gap-4 justify-center bg-slate-50 p-4 rounded-xl border border-slate-200">` + [1,2,3,4,5].map(s => `<label class="cursor-pointer hover:scale-110 transition flex flex-col items-center gap-1"><input type="radio" name="q_${i}" value="${s}" required class="hidden peer"><span class="text-xl grayscale opacity-40 peer-checked:grayscale-0 peer-checked:opacity-100 peer-checked:scale-125 transition font-bold text-slate-700 hover:text-blue-600">${s}</span></label>`).join('') + `</div>`;
        con.innerHTML += `<div><label class="block text-xs font-bold uppercase text-slate-500 mb-2 ml-1 tracking-wider">${q.text}</label>${inp}</div>`;
    });
}

document.getElementById('dynamicForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = globalForms[document.getElementById('formSelect').value];
    const answers = currentStructure.map((q, i) => {
        let val = '';
        if (q.type === 'rating') { const el = document.querySelector(`input[name="q_${i}"]:checked`); val = el ? el.value : '0'; }
        else val = document.querySelector(`[name="q_${i}"]`).value;
        return { question: q.text, answer: val, type: q.type, mapping: q.mapping };
    });
    
    const payload = {
        form_id: form.id,
        form_title: form.title,
        student_name: document.getElementById('student_name').value || 'Anonymous',
        // Note: Attendance is removed from frontend, backend defaults it.
        answers
    };
    
    try {
        await fetch('/api/submit_feedback', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        document.getElementById('resultModal').classList.remove('hidden');
    } catch(e) { alert("Error submitting"); }
});

init();