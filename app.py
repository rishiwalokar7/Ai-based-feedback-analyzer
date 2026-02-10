import sqlite3
import os
import json
from flask import Flask, render_template, request, jsonify, session, redirect, url_for
from datetime import datetime

app = Flask(__name__)
app.secret_key = "obe_nba_secret"

def init_db():
    if not os.path.exists('instance'): os.makedirs('instance')
    conn = sqlite3.connect('instance/feedback.db')
    c = conn.cursor()
    c.execute('''CREATE TABLE IF NOT EXISTS forms (
        id INTEGER PRIMARY KEY AUTOINCREMENT, 
        title TEXT, 
        course_name TEXT,
        structure TEXT, 
        is_active BOOLEAN DEFAULT 1, 
        created_at TEXT
    )''')
    c.execute('''CREATE TABLE IF NOT EXISTS responses (
        id INTEGER PRIMARY KEY AUTOINCREMENT, 
        form_id INTEGER, 
        form_title TEXT, 
        student_name TEXT, 
        attendance INTEGER,
        answers_json TEXT, 
        timestamp TEXT
    )''')
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

# --- API ---
@app.route('/api/create_form', methods=['POST'])
def create_form():
    if 'user' not in session: return jsonify({"error": "Unauthorized"}), 401
    data = request.json
    conn = sqlite3.connect('instance/feedback.db'); c = conn.cursor()
    c.execute("INSERT INTO forms (title, course_name, structure, created_at) VALUES (?, ?, ?, ?)", 
              (data.get('title'), data.get('course_name'), json.dumps(data.get('questions')), datetime.now().strftime("%Y-%m-%d")))
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
        data = request.json
        attendance = int(data.get('attendance', 0))
        conn = sqlite3.connect('instance/feedback.db'); c = conn.cursor()
        c.execute('''INSERT INTO responses (form_id, form_title, student_name, attendance, answers_json, timestamp) VALUES (?, ?, ?, ?, ?, ?)''', 
                  (data.get('form_id'), data.get('form_title'), data.get('student_name', 'Anonymous'), attendance, json.dumps(data.get('answers')), datetime.now().strftime("%Y-%m-%d %H:%M:%S")))
        conn.commit(); conn.close()
        return jsonify({"status": "success"})
    except Exception as e: return jsonify({"error": str(e)}), 500

# --- FIXED ATTAINMENT LOGIC ---
@app.route('/api/attainment', methods=['GET'])
def get_attainment():
    if 'user' not in session: return jsonify({"error": "Unauthorized"}), 401
    form_id = request.args.get('form_id')
    
    conn = sqlite3.connect('instance/feedback.db'); conn.row_factory = sqlite3.Row; c = conn.cursor()
    c.execute("SELECT * FROM responses WHERE form_id = ?", (form_id,))
    responses = c.fetchall()
    conn.close()

    if not responses: return jsonify({"stats": [], "total": 0, "avg_attendance": 0})

    # Initialize stats for ALL possible keys to avoid KeyErrors
    stats = {}
    # Create CO1-CO6
    for i in range(1, 7): stats[f"CO{i}"] = {"sum": 0, "count": 0}
    # Create PO1-PO12
    for i in range(1, 13): stats[f"PO{i}"] = {"sum": 0, "count": 0}
    # Create PSO1-PSO3
    for i in range(1, 4): stats[f"PSO{i}"] = {"sum": 0, "count": 0}
    
    total_attendance = 0

    for r in responses:
        total_attendance += r['attendance']
        answers = json.loads(r['answers_json'])
        for ans in answers:
            if ans['type'] == 'rating' and 'mapping' in ans:
                key = ans['mapping']
                score = int(ans['answer'])
                
                # Check if key exists in our initialized stats (Safe check)
                if key in stats:
                    stats[key]["sum"] += score
                    stats[key]["count"] += 1

    # Calculate Levels
    report = []
    # Sort keys: COs first, then POs, then PSOs
    all_keys = sorted(stats.keys(), key=lambda x: (x[:2] != "CO", x[:2] != "PO", int(x[2:] if x.startswith("PO") else x[3:] if x.startswith("PSO") else x[2:])))

    for key in all_keys:
        data = stats[key]
        if data['count'] > 0:
            avg_score = data['sum'] / data['count']
            percentage = (avg_score / 5) * 100
            
            level = "L1 (Low)"
            color = "text-red-600 bg-red-50"
            if percentage >= 70: 
                level = "L3 (High)"
                color = "text-green-600 bg-green-50"
            elif percentage >= 60: 
                level = "L2 (Moderate)"
                color = "text-yellow-600 bg-yellow-50"

            report.append({
                "code": key,
                "avg": round(avg_score, 2),
                "pct": round(percentage, 1),
                "level": level,
                "color": color
            })

    total_students = len(responses)
    avg_attendance = round(total_attendance / total_students, 1) if total_students > 0 else 0

    return jsonify({
        "stats": report,
        "total": total_students,
        "avg_attendance": avg_attendance
    })

if __name__ == '__main__':
    app.run(debug=True)