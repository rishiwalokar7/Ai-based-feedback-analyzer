import sqlite3
import os
import json
import csv
import io
import uuid
from flask import Flask, render_template, request, jsonify, session, redirect, url_for, make_response
from datetime import datetime
from fpdf import FPDF
from textblob import TextBlob

# Set matplotlib to run in background (headless mode) for server use
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

app = Flask(__name__)
app.secret_key = "obe_nba_secret"

def init_db():
    if not os.path.exists('instance'): os.makedirs('instance')
    conn = sqlite3.connect('instance/feedback.db')
    c = conn.cursor()
    c.execute('''CREATE TABLE IF NOT EXISTS forms (
        id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT, course_name TEXT, structure TEXT, is_active BOOLEAN DEFAULT 1, created_at TEXT
    )''')
    c.execute('''CREATE TABLE IF NOT EXISTS responses (
        id INTEGER PRIMARY KEY AUTOINCREMENT, form_id INTEGER, form_title TEXT, student_name TEXT, attendance INTEGER, 
        answers_json TEXT, full_text_for_ai TEXT, sentiment_score REAL, sentiment_label TEXT, timestamp TEXT
    )''')
    conn.commit()
    conn.close()

init_db()

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
        answers = data.get('answers', [])
        
        # --- SENTIMENT CALCULATION ---
        rating_sum = 0; rating_count = 0; text_parts = []
        for ans in answers:
            val = ans.get('answer', '')
            if ans.get('type') == 'rating' and val:
                try: rating_sum += int(val); rating_count += 1
                except: pass
            elif ans.get('type') in ['text', 'long_text'] and val.strip():
                text_parts.append(val)

        full_text = ". ".join(text_parts)
        text_score = TextBlob(full_text).sentiment.polarity if full_text else 0.0

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

        conn = sqlite3.connect('instance/feedback.db'); c = conn.cursor()
        c.execute('''INSERT INTO responses (form_id, form_title, student_name, attendance, answers_json, full_text_for_ai, sentiment_score, sentiment_label, timestamp) 
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)''', 
                  (data.get('form_id'), data.get('form_title'), data.get('student_name', 'Anonymous'), 100, json.dumps(answers), full_text, final_score, label, datetime.now().strftime("%Y-%m-%d %H:%M:%S")))
        conn.commit(); conn.close()
        return jsonify({"status": "success"})
    except Exception as e: return jsonify({"error": str(e)}), 500

# --- CORE ATTAINMENT ENGINE ---
def get_attainment_data(form_id):
    conn = sqlite3.connect('instance/feedback.db'); conn.row_factory = sqlite3.Row; c = conn.cursor()
    c.execute("SELECT * FROM responses WHERE form_id = ?", (form_id,))
    responses = c.fetchall()
    c.execute("SELECT * FROM forms WHERE id = ?", (form_id,))
    form_data = c.fetchone()
    conn.close()

    course_name = form_data['course_name'] if form_data else "Unknown"
    form_title = form_data['title'] if form_data else "Unknown"
    structure = json.loads(form_data['structure']) if form_data and form_data['structure'] else []

    if not responses: 
        return {"stats": [], "question_stats": [], "sentiment": {}, "total": 0, "course_name": course_name, "title": form_title, "responses": []}

    stats = {}
    for i in range(1, 7): stats[f"CO{i}"] = {"sum": 0, "count": 0}
    for i in range(1, 13): stats[f"PO{i}"] = {"sum": 0, "count": 0}
    for i in range(1, 4): stats[f"PSO{i}"] = {"sum": 0, "count": 0}
    
    question_stats = []
    for q in structure:
        question_stats.append({"text": q.get('text', ''), "type": q.get('type', 'text'), "mapping": q.get('mapping', 'None'), "sum": 0, "count": 0})

    pos = 0; neu = 0; neg = 0; timeline = []; stars = [0, 0, 0, 0, 0]

    for r in responses:
        lbl = r['sentiment_label']
        if lbl == 'Positive': pos += 1
        elif lbl == 'Negative': neg += 1
        else: neu += 1
        timeline.append(r['sentiment_score'])

        answers = json.loads(r['answers_json'])
        for ans in answers:
            if ans['type'] == 'rating' and 'mapping' in ans:
                key = ans['mapping']
                if key in stats:
                    stats[key]["sum"] += int(ans['answer'])
                    stats[key]["count"] += 1
                stars[int(ans['answer'])-1] += 1
            
            for qs in question_stats:
                if qs['text'] == ans['question']:
                    if qs['type'] == 'rating' and ans['answer']:
                        qs['sum'] += int(ans['answer'])
                        qs['count'] += 1
                    elif qs['type'] == 'text' and str(ans['answer']).strip():
                        qs['count'] += 1

    report = []
    all_keys = sorted(stats.keys(), key=lambda x: (x[:2] != "CO", x[:2] != "PO", int(x[2:] if x.startswith("PO") else x[3:] if x.startswith("PSO") else x[2:])))
    for key in all_keys:
        data = stats[key]
        if data['count'] > 0:
            avg_score = data['sum'] / data['count']
            percentage = (avg_score / 5) * 100
            level = "L1 (Low)"; color = "text-red-600 bg-red-50"
            if percentage >= 70: level = "L3 (High)"; color = "text-green-600 bg-green-50"
            elif percentage >= 60: level = "L2 (Moderate)"; color = "text-yellow-600 bg-yellow-50"
            report.append({"code": key, "avg": round(avg_score, 2), "pct": round(percentage, 1), "level": level, "color": color, "student_count": data['count']})

    for qs in question_stats:
        qs['avg'] = round(qs['sum'] / qs['count'], 2) if qs['type'] == 'rating' and qs['count'] > 0 else 0

    total_students = len(responses)

    return {
        "stats": report,
        "question_stats": question_stats,
        "sentiment": {"pos": pos, "neu": neu, "neg": neg, "timeline": timeline, "stars": stars},
        "total": total_students,
        "course_name": course_name,
        "title": form_title,
        "responses": [dict(r) for r in responses]
    }

@app.route('/api/attainment', methods=['GET'])
def get_attainment_api():
    if 'user' not in session: return jsonify({"error": "Unauthorized"}), 401
    form_id = request.args.get('form_id')
    return jsonify(get_attainment_data(form_id))

# --- EXPORTS ---
@app.route('/api/export_csv', methods=['GET'])
def export_csv():
    if 'user' not in session: return jsonify({"error": "Unauthorized"}), 401
    data = get_attainment_data(request.args.get('form_id'))
    si = io.StringIO(); cw = csv.writer(si)
    cw.writerow(['COURSE OBE & FEEDBACK REPORT', data['course_name']])
    cw.writerow(['Total Students', data['total']])
    cw.writerow([])
    
    sent = data['sentiment']
    cw.writerow(['CLASS SENTIMENT ANALYSIS'])
    cw.writerow(['Positive', 'Neutral', 'Negative'])
    cw.writerow([sent.get('pos',0), sent.get('neu',0), sent.get('neg',0)])
    cw.writerow([])

    cw.writerow(['PART 1: OUTCOME ATTAINMENT'])
    cw.writerow(['Code', 'Students', 'Average Rating', 'Attainment %', 'NBA Level'])
    for row in data['stats']: cw.writerow([row['code'], row['student_count'], row['avg'], f"{row['pct']}%", row['level']])
    cw.writerow([])
    
    cw.writerow(['PART 2: RAW RESPONSES & SENTIMENT'])
    cw.writerow(['Student', 'Sentiment', 'Answers'])
    for r in data['responses']:
        ans = json.loads(r['answers_json'])
        qa = " | ".join([f"[{a.get('mapping', '')}] {a['answer']}" for a in ans])
        cw.writerow([r['student_name'], r['sentiment_label'], qa])
    output = make_response(si.getvalue())
    output.headers["Content-Disposition"] = f"attachment; filename={data['course_name']}_Data.csv"
    output.headers["Content-type"] = "text/csv"
    return output

@app.route('/api/export_pdf', methods=['GET'])
def export_pdf():
    if 'user' not in session: return jsonify({"error": "Unauthorized"}), 401
    form_id = request.args.get('form_id')
    data = get_attainment_data(form_id)
    
    pdf = FPDF()
    pdf.add_page()
    
    # Header
    pdf.set_font("Arial", 'B', 15)
    pdf.cell(0, 8, txt="DEPARTMENT OF COMPUTER SCIENCE AND ENGINEERING", ln=True, align='C')
    pdf.set_font("Arial", 'B', 11); pdf.cell(0, 6, txt="OBE & SENTIMENT REPORT", ln=True, align='C'); pdf.ln(8)
    
    pdf.set_font("Arial", 'B', 10)
    pdf.cell(35, 7, "Course Name:", 0, 0); pdf.set_font("Arial", '', 10); pdf.cell(0, 7, data['course_name'], 0, 1)
    pdf.set_font("Arial", 'B', 10)
    pdf.cell(35, 7, "Date:", 0, 0); pdf.set_font("Arial", '', 10); pdf.cell(0, 7, datetime.now().strftime('%Y-%m-%d %H:%M'), 0, 1)
    pdf.ln(3); pdf.set_fill_color(230, 240, 255); pdf.set_font("Arial", 'B', 10)
    pdf.cell(0, 8, f" Total Students Evaluated: {data['total']}", 1, 1, 'L', True); pdf.ln(8)
    
    # --- PART 1: OBE ---
    pdf.set_font("Arial", 'B', 12); pdf.cell(0, 8, "PART 1: OBE Attainment", ln=True)
    pdf.set_fill_color(50, 50, 50); pdf.set_text_color(255, 255, 255); pdf.set_font("Arial", 'B', 9)
    pdf.cell(30, 8, 'Outcome', 1, 0, 'C', True); pdf.cell(35, 8, 'Students', 1, 0, 'C', True); pdf.cell(35, 8, 'Average Rating', 1, 0, 'C', True); pdf.cell(40, 8, 'Attainment %', 1, 0, 'C', True); pdf.cell(50, 8, 'Level', 1, 1, 'C', True)
    pdf.set_text_color(0, 0, 0); pdf.set_font("Arial", '', 9)
    for row in data['stats']:
        pdf.cell(30, 8, row['code'], 1, 0, 'C'); pdf.cell(35, 8, str(row['student_count']), 1, 0, 'C'); pdf.cell(35, 8, f"{row['avg']}/5", 1, 0, 'C'); pdf.cell(40, 8, f"{row['pct']}%", 1, 0, 'C'); pdf.cell(50, 8, row['level'].upper(), 1, 1, 'C')
    
    # --- PART 2: QUESTION BREAKDOWN ---
    pdf.ln(10); pdf.set_font("Arial", 'B', 12); pdf.cell(0, 8, "PART 2: Question Breakdown", ln=True)
    for i, qs in enumerate(data['question_stats']):
        pdf.set_fill_color(245, 245, 245); pdf.set_font("Arial", 'B', 9)
        pdf.multi_cell(0, 7, f"Q{i+1}: {qs['text'].encode('latin-1', 'replace').decode('latin-1')}", fill=True)
        pdf.set_font("Arial", '', 9)
        pdf.cell(0, 6, f"Average Rating: {qs['avg']} / 5.0" if qs['type'] == 'rating' else f"Comments: {qs['count']}", ln=True)

    # --- PART 3: GRAPHICAL CHARTS (Generated via Matplotlib) ---
    pdf.add_page() # Put charts on a fresh page
    pdf.set_font("Arial", 'B', 14)
    pdf.cell(0, 10, "PART 3: Visual Analysis Charts", ln=True, align='C')
    pdf.line(10, 20, 200, 20)
    pdf.ln(5)

    sent = data.get('sentiment', {'pos':0, 'neu':0, 'neg':0, 'stars': [0,0,0,0,0]})
    total_sent = sent.get('pos',0) + sent.get('neu',0) + sent.get('neg',0)

    if total_sent == 0:
        pdf.set_font("Arial", '', 10)
        pdf.cell(0, 10, "No feedback data available to generate charts.", ln=True, align='C')
    else:
        uid = str(uuid.uuid4())
        pie_path = f"temp_pie_{uid}.png"
        bar_path = f"temp_bar_{uid}.png"

        try:
            # 1. Generate Pie Chart (Sentiment)
            labels = ['Positive', 'Neutral', 'Negative']
            sizes = [sent.get('pos',0), sent.get('neu',0), sent.get('neg',0)]
            colors = ['#22c55e', '#94a3b8', '#ef4444']
            
            plt.figure(figsize=(5, 4))
            plt.pie(sizes, labels=labels, colors=colors, autopct='%1.1f%%', startangle=140)
            plt.title('Sentiment Distribution')
            plt.savefig(pie_path, bbox_inches='tight')
            plt.close()

            # 2. Generate Bar Chart (Ratings)
            stars = sent.get('stars', [0,0,0,0,0])
            plt.figure(figsize=(5, 4))
            plt.bar(['1 Star', '2 Star', '3 Star', '4 Star', '5 Star'], stars, color='#3b82f6')
            plt.title('Rating Spread')
            plt.xlabel('Ratings')
            plt.ylabel('Responses')
            plt.savefig(bar_path, bbox_inches='tight')
            plt.close()

            # 3. Add Images to PDF Side-by-Side
            curr_y = pdf.get_y()
            pdf.image(pie_path, x=10, y=curr_y, w=90)
            pdf.image(bar_path, x=110, y=curr_y, w=90)

        finally:
            # 4. Clean up the temporary image files
            if os.path.exists(pie_path): os.remove(pie_path)
            if os.path.exists(bar_path): os.remove(bar_path)

    res = make_response(pdf.output(dest='S').encode('latin-1'))
    res.headers['Content-Type'] = 'application/pdf'
    res.headers['Content-Disposition'] = f"attachment; filename={data['course_name'].replace(' ', '_')}_Report.pdf"
    return res

if __name__ == '__main__':
    app.run(debug=True)