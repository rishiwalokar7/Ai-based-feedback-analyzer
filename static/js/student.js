document.addEventListener('DOMContentLoaded', () => {
    let globalForms = [], currentStructure = [], currentChannel = 'Web';

    async function init() {
        try {
            const res = await fetch('/api/forms?active_only=true');
            globalForms = await res.json();
            const sel = document.getElementById('formSelect');
            sel.innerHTML = '<option value="" disabled selected>Select an active topic...</option>';
            if (globalForms.length === 0) sel.innerHTML = '<option disabled>No active forms available.</option>';
            globalForms.forEach((f, i) => { const o = document.createElement('option'); o.value = i; o.text = f.title; sel.appendChild(o); });
        } catch (e) { console.error("Error:", e); }
    }

    const formSelect = document.getElementById('formSelect');
    if(formSelect) formSelect.addEventListener('change', renderForm);
    document.getElementById('btn-web').addEventListener('click', () => setChannel('web'));
    document.getElementById('btn-email').addEventListener('click', () => setChannel('email'));
    document.getElementById('btn-email-submit').addEventListener('click', submitEmail);
    document.getElementById('dynamicForm').addEventListener('submit', submitWebForm);

    function setChannel(ch) {
        currentChannel = ch.charAt(0).toUpperCase() + ch.slice(1);
        document.querySelectorAll('#btn-web, #btn-email').forEach(b => {
            b.className = "flex-1 py-2.5 rounded-lg text-sm font-bold text-slate-500 hover:text-slate-900 hover:bg-slate-50 transition flex items-center justify-center gap-2";
        });
        document.getElementById(`btn-${ch}`).className = "flex-1 py-2.5 rounded-lg text-sm font-bold bg-slate-900 text-white shadow-md transition flex items-center justify-center gap-2";
        if (document.getElementById('selectorCard').classList.contains('hidden')) showChannelUI();
    }

    function renderForm() {
        const sel = document.getElementById('formSelect');
        if (sel.value === "") return;
        const form = globalForms[sel.value];
        currentStructure = form.structure;
        document.getElementById('selectorCard').classList.add('hidden');
        document.getElementById('emailSubject').value = `Feedback: ${form.title}`;
        document.getElementById('dynamicTitle').innerText = form.title;
        const con = document.getElementById('questionsArea'); con.innerHTML = '';
        
        currentStructure.forEach((q, i) => {
            let inp = '';
            // RENDER DYNAMIC INPUTS
            if (q.type === 'text') {
                inp = `<input type="text" name="q_${i}" class="w-full p-4 bg-white border border-slate-200 rounded-xl text-slate-800 outline-none focus:border-blue-500 shadow-sm ai-target" required placeholder="Type answer...">`;
            } else if (q.type === 'long_text') {
                inp = `<textarea name="q_${i}" rows="3" class="w-full p-4 bg-white border border-slate-200 rounded-xl text-slate-800 outline-none focus:border-blue-500 shadow-sm ai-target" required placeholder="Detailed feedback..."></textarea>`;
            } else if (q.type === 'rating') {
                inp = `<div class="flex gap-4 justify-center bg-slate-50 p-4 rounded-xl border border-slate-200">` + 
                      [1,2,3,4,5].map(s => `<label class="cursor-pointer hover:scale-110 transition group flex flex-col items-center gap-1"><input type="radio" name="q_${i}" value="${s}" required class="hidden peer"><span class="text-2xl grayscale opacity-50 peer-checked:grayscale-0 peer-checked:opacity-100 peer-checked:scale-125 transition">${s === 1 ? '😠' : s === 2 ? '🙁' : s === 3 ? '😐' : s === 4 ? '🙂' : '🤩'}</span></label>`).join('') + 
                      `</div>`;
            } else if (q.type === 'file') {
                // NEW FILE INPUT
                inp = `<input type="file" name="q_${i}" class="w-full p-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-slate-900 file:text-white hover:file:bg-slate-700">`;
            }
            con.innerHTML += `<div><label class="block text-xs font-bold uppercase text-slate-500 mb-2 ml-1 tracking-wider">${q.text}</label>${inp}</div>`;
        });
        showChannelUI();
    }

    function showChannelUI() {
        document.querySelectorAll('.channel-view').forEach(el => el.classList.add('hidden'));
        document.getElementById(`channel-${currentChannel.toLowerCase()}`).classList.remove('hidden');
    }

    async function submitWebForm(e) {
        e.preventDefault();
        const sel = document.getElementById('formSelect');
        const form = globalForms[sel.value];
        
        // Prepare FormData
        const formData = new FormData();
        formData.append('form_id', form.id);
        formData.append('form_title', form.title);
        formData.append('student_name', document.getElementById('student_name').value || 'Anonymous');
        formData.append('channel', 'Web');
        
        // Pass Structure so backend knows how to unpack
        formData.append('structure', JSON.stringify(currentStructure));

        // Append all inputs
        currentStructure.forEach((q, i) => {
            const key = `q_${i}`;
            if (q.type === 'file') {
                const fileInput = document.querySelector(`input[name="${key}"]`);
                if (fileInput && fileInput.files.length > 0) {
                    formData.append(key, fileInput.files[0]);
                }
            } else if (q.type === 'rating') {
                const checked = document.querySelector(`input[name="${key}"]:checked`);
                if (checked) formData.append(key, checked.value);
            } else {
                const val = document.querySelector(`[name="${key}"]`).value;
                formData.append(key, val);
            }
        });

        sendData(formData);
    }

    function submitEmail() {
        const body = document.getElementById('emailBody').value; 
        if (!body) return alert("Empty");
        
        const sel = document.getElementById('formSelect'); 
        const form = globalForms[sel.value];
        
        // Simulating form data for email
        const formData = new FormData();
        formData.append('form_id', form.id);
        formData.append('form_title', form.title);
        formData.append('student_name', "Email User");
        formData.append('channel', 'Email');
        
        // Mock structure for backend
        const mockStruct = [{text: "Email Content", type: "long_text"}];
        formData.append('structure', JSON.stringify(mockStruct));
        formData.append('q_0', body);
        
        sendData(formData);
    }

    async function sendData(formData) {
        document.querySelectorAll('.channel-view').forEach(el => el.classList.add('hidden'));
        document.getElementById('loadingState').classList.remove('hidden');
        
        try {
            const res = await fetch('/api/submit_feedback', { method: 'POST', body: formData });
            const result = await res.json();
            
            if(result.error) throw new Error(result.error);
            document.getElementById('loadingState').classList.add('hidden');
            document.getElementById('resultModal').classList.remove('hidden');
        } catch (e) { 
            document.getElementById('loadingState').classList.add('hidden');
            alert("Error: " + e.message); location.reload(); 
        }
    }

    init();
});