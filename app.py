import os
import pandas as pd
from flask import Flask, render_template, request, jsonify

app = Flask(__name__)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/upload', methods=['POST'])
def upload_file():
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400

    if file and file.filename.endswith('.csv'):
        try:
            # Read CSV directly into Pandas DataFrame
            df = pd.read_csv(file)
            
            # Basic validation
            required_cols = ['Date', 'Employee_ID', 'Name', 'Department', 'Status']
            if not all(col in df.columns for col in required_cols):
                return jsonify({'error': f'Missing required columns. Expected: {", ".join(required_cols)}'}), 400

            # --- Calculate Summary KPIs ---
            total_employees = df['Employee_ID'].nunique()
            total_records = len(df)
            total_present = len(df[df['Status'].str.lower() == 'present'])
            total_absent = len(df[df['Status'].str.lower() == 'absent'])
            
            avg_attendance_pct = round((total_present / total_records) * 100, 2) if total_records > 0 else 0

            # --- Chart Data Processing ---
            
            # 1. Line Chart: Daily Attendance Trend (Count of Present per Date)
            df['Date'] = pd.to_datetime(df['Date']).dt.strftime('%Y-%m-%d')
            present_df = df[df['Status'].str.lower() == 'present']
            daily_trend = present_df.groupby('Date').size().reset_index(name='Present_Count')
            trend_labels = daily_trend['Date'].tolist()
            trend_data = daily_trend['Present_Count'].tolist()

            # 2. Pie Chart: Overall Status Breakdown
            status_counts = df['Status'].str.capitalize().value_counts().to_dict()

            # 3. Bar Chart: Attendance % by Department
            dept_stats = df.groupby('Department').apply(
                lambda x: (len(x[x['Status'].str.lower() == 'present']) / len(x)) * 100
            ).reset_index(name='Attendance_Pct')
            dept_labels = dept_stats['Department'].tolist()
            dept_data = dept_stats['Attendance_Pct'].round(2).tolist()

            # --- Raw Data for Table ---
            raw_data = df.to_dict(orient='records')

            return jsonify({
                'kpis': {
                    'total_employees': total_employees,
                    'avg_attendance': avg_attendance_pct,
                    'total_present': total_present,
                    'total_absent': total_absent
                },
                'charts': {
                    'trend': {'labels': trend_labels, 'data': trend_data},
                    'status': {'labels': list(status_counts.keys()), 'data': list(status_counts.values())},
                    'department': {'labels': dept_labels, 'data': dept_data}
                },
                'table': raw_data
            })
            
        except Exception as e:
            return jsonify({'error': str(e)}), 500
    
    return jsonify({'error': 'Invalid file format. Please upload a CSV.'}), 400

if __name__ == '__main__':
    app.run(debug=True, port=5000)