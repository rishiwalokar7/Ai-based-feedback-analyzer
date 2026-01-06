import sqlite3
import os
import json
from flask import Flask, render_template, request, jsonify, session, redirect, url_for, send_from_directory
from werkzeug.utils import secure_filename
from textblob import TextBlob
from datetime import datetime
from fpdf import FPDF
from collections import Counter
import google.generativeai as genai

app = Flask(__name__)
app.secret_key = "saas_secret_key"
app.config['UPLOAD_FOLDER'] = 'uploads'
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

# --- GEMINI SETUP ---
API_KEY = "" # Paste Key Here
try:
    if API_KEY:
        genai.configure(api_key=API_KEY)
        model = genai.GenerativeModel('gemini-1.5-flash')
        print("✅ AI Online")
    else:
        model = None
        print("⚠️ AI Offline")
except: model = None

def init_db():
    if not os.path.exists('instance'): os.makedirs('instance')
    conn = sqlite3.connect('instance/feedback.db')
    c = conn.cursor()
    c.execute('''CREATE TABLE IF NOT EXISTS forms (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT, structure TEXT, is_active BOOLEAN DEFAULT 1, created_at TEXT)''')
    # Schema includes file_path (legacy) but we store file paths in answers_json now
    c.execute('''CREATE TABLE IF NOT EXISTS responses (id INTEGER PRIMARY KEY AUTOINCREMENT, form_id INTEGER, form_title TEXT, student_name TEXT, answers_json TEXT, full_text_for_ai TEXT, sentiment_score REAL, sentiment_label TEXT, subjectivity REAL, word_count INTEGER, caps_ratio REAL, channel TEXT, file_path TEXT, timestamp TEXT)''')
    conn.commit()
    conn.close()

init_db()

# --- ROUTES ---
@app.route('/')
def landing(): return render_template('landing.html')
@app.route('/student')
def student(): return render_template('student.html')
@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        if request.form.get('username') == 'admin' and request.form.get('password') == 'admin123':
            session['user'] = 'admin'; return redirect(url_for('dashboard'))
        return render_template('login.html', error="Invalid Credentials")
    return render_template('login.html')
@app.route('/dashboard')
def dashboard(): return render_template('dashboard.html') if 'user' in session else redirect(url_for('login'))
@app.route('/logout')
def logout(): session.pop('user', None); return redirect(url_for('landing'))
@app.route('/uploads/<filename>')
def uploaded_file(filename):
    if 'user' not in session: return "Unauthorized", 401
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)

# --- API ---
@app.route('/api/create_form', methods=['POST'])
def create_form():
    if 'user' not in session: return jsonify({"error": "Unauthorized"}), 401
    data = request.json
    conn = sqlite3.connect('instance/feedback.db'); c = conn.cursor()
    c.execute("INSERT INTO forms (title, structure, created_at) VALUES (?, ?, ?)", (data.get('title'), json.dumps(data.get('questions')), datetime.now().strftime("%Y-%m-%d")))
    conn.commit(); conn.close()
    return jsonify({"status": "success"})

@app.route('/api/forms', methods=['GET'])
def get_forms():
    conn = sqlite3.connect('instance/feedback.db'); conn.row_factory = sqlite3.Row; c = conn.cursor()
    if request.args.get('active_only'): c.execute("SELECT * FROM forms WHERE is_active = 1 ORDER BY id DESC")
    else: c.execute("SELECT * FROM forms ORDER BY id DESC")
    rows = c.fetchall(); conn.close()
    results = [dict(row) for row in rows]
    for r in results: r['structure'] = json.loads(r['structure'])
    return jsonify(results)

@app.route('/api/toggle_form', methods=['POST'])
def toggle_form():
    if 'user' not in session: return jsonify({"error": "Unauthorized"}), 401
    conn = sqlite3.connect('instance/feedback.db'); c = conn.cursor()
    c.execute("UPDATE forms SET is_active = ? WHERE id = ?", (request.json.get('status'), request.json.get('id')))
    conn.commit(); conn.close()
    return jsonify({"status": "success"})

@app.route('/api/submit_feedback', methods=['POST'])
def submit_feedback():
    try:
        # 1. Extract Data from FormData
        form_id = request.form.get('form_id')
        form_title = request.form.get('form_title')
        student_name = request.form.get('student_name') or 'Anonymous'
        channel = request.form.get('channel', 'Web')
        
        # Parse the JSON structure of the form to map answers
        structure = json.loads(request.form.get('structure'))
        
        final_answers = []
        text_parts = []
        rating_sum = 0
        rating_count = 0

        # 2. Iterate through structure to find answers
        for i, question in enumerate(structure):
            key = f"q_{i}"
            answer_val = ""
            
            if question['type'] == 'file':
                # Handle File Upload
                if key in request.files:
                    file = request.files[key]
                    if file.filename != '':
                        filename = secure_filename(f"{datetime.now().timestamp()}_{file.filename}")
                        file.save(os.path.join(app.config['UPLOAD_FOLDER'], filename))
                        answer_val = f"[FILE: {filename}]"
                    else:
                        answer_val = "[No File]"
            else:
                # Handle Text/Rating
                answer_val = request.form.get(key, "")
                
                # Sentiment Data Gathering
                if question['type'] == 'rating' and answer_val:
                    try:
                        rating_sum += int(answer_val)
                        rating_count += 1
                    except: pass
                elif question['type'] in ['text', 'long_text'] and answer_val:
                    text_parts.append(answer_val)

            final_answers.append({
                "question": question['text'],
                "answer": answer_val,
                "type": question['type']
            })

        # 3. Sentiment Logic
        full_text = ". ".join(text_parts)
        text_score = 0; subjectivity = 0.5; word_count = 0; caps_ratio = 0.0
        
        if full_text:
            blob = TextBlob(full_text)
            text_score = blob.sentiment.polarity
            subjectivity = blob.sentiment.subjectivity
            word_count = len(full_text.split())
            caps_count = sum(1 for c in full_text if c.isupper())
            char_len = len(full_text) - full_text.count(' ')
            if char_len > 0: caps_ratio = caps_count / char_len

        final_score = 0; label = "Neutral"
        if rating_count > 0:
            avg = rating_sum / rating_count
            if avg >= 4: label = "Positive"; final_score = 0.6 + (0.4 * text_score)
            elif avg <= 2: label = "Negative"; final_score = -0.6 + (0.4 * text_score)
            else: label = "Neutral"; final_score = text_score
        else:
            final_score = text_score
            if final_score > 0.15: label = "Positive"
            elif final_score < -0.15: label = "Negative"
            else: label = "Neutral"

        # 4. Save
        conn = sqlite3.connect('instance/feedback.db'); c = conn.cursor()
        c.execute('''INSERT INTO responses (form_id, form_title, student_name, answers_json, full_text_for_ai, sentiment_score, sentiment_label, subjectivity, word_count, caps_ratio, channel, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)''', 
                  (form_id, form_title, student_name, json.dumps(final_answers), full_text, final_score, label, subjectivity, word_count, caps_ratio, channel, datetime.now().strftime("%Y-%m-%d %H:%M:%S")))
        conn.commit(); conn.close()
        
        return jsonify({"status": "success", "label": label})
        
    except Exception as e:
        print(f"Server Error: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/history', methods=['GET'])
def get_history():
    if 'user' not in session: return jsonify({"error": "Unauthorized"}), 401
    form_id = request.args.get('form_id')
    conn = sqlite3.connect('instance/feedback.db'); conn.row_factory = sqlite3.Row; c = conn.cursor()
    if form_id: c.execute("SELECT * FROM responses WHERE form_id = ? ORDER BY id DESC", (form_id,))
    else: c.execute("SELECT * FROM responses ORDER BY id DESC")
    rows = c.fetchall(); conn.close()
    results = []
    for row in rows: d = dict(row); d['answers'] = json.loads(d['answers_json']); results.append(d)
    return jsonify({"responses": results})

# --- AI & EXPORTS ---
@app.route('/api/ai/refine', methods=['POST'])
def ai_refine():
    text = request.json.get('text'); 
    if not text: return jsonify({"error": "No text"}), 400
    if not model: return jsonify({"refined": text})
    try:
        response = model.generate_content(f"Rewrite to be professional: '{text}'")
        return jsonify({"refined": response.text.strip()})
    except: return jsonify({"refined": text})

@app.route('/api/ai/report', methods=['POST'])
def ai_report():
    if 'user' not in session: return jsonify({"error": "Unauthorized"}), 401
    form_id = request.json.get('form_id')
    conn = sqlite3.connect('instance/feedback.db'); c = conn.cursor()
    c.execute("SELECT full_text_for_ai FROM responses WHERE form_id = ?", (form_id,)); rows = c.fetchall(); conn.close()
    text_data = "\n".join([r[0] for r in rows if r[0]])
    if not text_data: return jsonify({"report": "No data available."})
    if not model: return jsonify({"report": "<h3>AI Offline</h3><p>Configure API Key.</p>"})
    try:
        response = model.generate_content(f"Analyze feedback. HTML format <h3>,<ul>,<li>: {text_data[:8000]}")
        return jsonify({"report": response.text})
    except Exception as e: return jsonify({"error": str(e)}), 500

@app.route('/api/export_csv', methods=['GET'])
def export_csv():
    if 'user' not in session: return jsonify({"error": "Unauthorized"}), 401
    form_id = request.args.get('form_id')
    conn = sqlite3.connect('instance/feedback.db'); c = conn.cursor()
    c.execute("SELECT title FROM forms WHERE id = ?", (form_id,)); title = c.fetchone()[0]
    c.execute("SELECT * FROM responses WHERE form_id = ?", (form_id,)); rows = c.fetchall(); conn.close()
    si = io.StringIO(); cw = csv.writer(si)
    cw.writerow(['Student', 'Label', 'Score', 'Responses'])
    for r in rows:
        ans = json.loads(r[4])
        qa = " | ".join([f"{a['question']}:{a['answer']}" for a in ans])
        cw.writerow([r[3], r[7], f"{r[6]:.2f}", qa])
    output = make_response(si.getvalue())
    output.headers["Content-Disposition"] = f"attachment; filename={title}.csv"; output.headers["Content-type"] = "text/csv"
    return output

@app.route('/api/export_pdf', methods=['GET'])
def export_pdf():
    if 'user' not in session: return jsonify({"error": "Unauthorized"}), 401
    form_id = request.args.get('form_id')
    conn = sqlite3.connect('instance/feedback.db'); c = conn.cursor()
    c.execute("SELECT title FROM forms WHERE id = ?", (form_id,)); title = c.fetchone()[0]
    c.execute("SELECT * FROM responses WHERE form_id = ?", (form_id,)); rows = c.fetchall(); conn.close()
    pdf = FPDF(); pdf.add_page(); pdf.set_font("Arial", size=12)
    pdf.cell(200, 10, txt=f"Report: {title}", ln=True, align='C'); pdf.ln(10)
    pdf.set_font("Arial", size=10)
    for r in rows:
        ans = json.loads(r[4])
        qa = ", ".join([f"{a['question'][:20]}..: {str(a['answer'])[:30]}" for a in ans])
        qa = qa.encode('latin-1', 'replace').decode('latin-1')
        pdf.cell(0, 10, f"{r[3]} | {r[7]}", ln=True); pdf.multi_cell(0, 10, qa); pdf.ln(5)
    res = make_response(pdf.output(dest='S').encode('latin-1'))
    res.headers['Content-Type'] = 'application/pdf'; res.headers['Content-Disposition'] = f'attachment; filename={title}.pdf'
    return res

if __name__ == '__main__':
    app.run(debug=True)