let trendChartInstance = null;
let statusChartInstance = null;
let deptChartInstance = null;

const REQUIRED_COLUMNS = ['Date', 'Employee_ID', 'Name', 'Department', 'Status'];

document.getElementById('uploadForm').addEventListener('submit', function (e) {
    e.preventDefault();

    const fileInput = document.getElementById('csvFile');
    const alertDiv = document.getElementById('uploadAlert');
    const dashboardContent = document.getElementById('dashboardContent');

    if (fileInput.files.length === 0) return;

    const file = fileInput.files[0];
    if (!file.name.toLowerCase().endsWith('.csv')) {
        alertDiv.innerHTML = '<div class="alert alert-danger">Invalid file format. Please upload a CSV.</div>';
        dashboardContent.classList.add('d-none');
        return;
    }

    alertDiv.innerHTML = '<div class="alert alert-info">Processing data...</div>';

    Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: function (results) {
            try {
                const columns = results.meta.fields || [];
                const missing = REQUIRED_COLUMNS.filter(col => !columns.includes(col));
                if (missing.length > 0) {
                    throw new Error(`Missing required columns. Expected: ${REQUIRED_COLUMNS.join(', ')}`);
                }

                const data = analyzeData(results.data);

                alertDiv.innerHTML = '';
                dashboardContent.classList.remove('d-none');

                document.getElementById('kpi-employees').innerText = data.kpis.total_employees;
                document.getElementById('kpi-avg').innerText = data.kpis.avg_attendance + '%';
                document.getElementById('kpi-present').innerText = data.kpis.total_present;
                document.getElementById('kpi-absent').innerText = data.kpis.total_absent;

                renderCharts(data.charts);
                populateTable(data.table);
            } catch (error) {
                alertDiv.innerHTML = `<div class="alert alert-danger">${error.message}</div>`;
                dashboardContent.classList.add('d-none');
            }
        },
        error: function (error) {
            alertDiv.innerHTML = `<div class="alert alert-danger">${error.message}</div>`;
            dashboardContent.classList.add('d-none');
        }
    });
});

function formatDate(value) {
    const parsed = new Date(value);
    if (isNaN(parsed.getTime())) return value;
    return parsed.toISOString().slice(0, 10);
}

function capitalize(str) {
    if (!str) return str;
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

function analyzeData(rows) {
    const records = rows
        .filter(row => row.Employee_ID !== undefined && row.Employee_ID !== '')
        .map(row => ({ ...row, Date: formatDate(row.Date) }));

    const totalRecords = records.length;
    const employeeIds = new Set(records.map(r => r.Employee_ID));
    const totalEmployees = employeeIds.size;

    const isPresent = row => (row.Status || '').toLowerCase() === 'present';
    const isAbsent = row => (row.Status || '').toLowerCase() === 'absent';

    const totalPresent = records.filter(isPresent).length;
    const totalAbsent = records.filter(isAbsent).length;
    const avgAttendancePct = totalRecords > 0 ? Math.round((totalPresent / totalRecords) * 10000) / 100 : 0;

    // Daily attendance trend (count of Present per Date), sorted chronologically
    const trendCounts = new Map();
    records.filter(isPresent).forEach(row => {
        trendCounts.set(row.Date, (trendCounts.get(row.Date) || 0) + 1);
    });
    const trendDates = Array.from(trendCounts.keys()).sort();

    // Overall status breakdown
    const statusCounts = new Map();
    records.forEach(row => {
        const status = capitalize(row.Status);
        statusCounts.set(status, (statusCounts.get(status) || 0) + 1);
    });

    // Attendance % by department
    const deptGroups = new Map();
    records.forEach(row => {
        if (!deptGroups.has(row.Department)) deptGroups.set(row.Department, []);
        deptGroups.get(row.Department).push(row);
    });
    const deptLabels = Array.from(deptGroups.keys());
    const deptData = deptLabels.map(dept => {
        const deptRows = deptGroups.get(dept);
        const presentCount = deptRows.filter(isPresent).length;
        return Math.round((presentCount / deptRows.length) * 10000) / 100;
    });

    return {
        kpis: {
            total_employees: totalEmployees,
            avg_attendance: avgAttendancePct,
            total_present: totalPresent,
            total_absent: totalAbsent
        },
        charts: {
            trend: { labels: trendDates, data: trendDates.map(d => trendCounts.get(d)) },
            status: { labels: Array.from(statusCounts.keys()), data: Array.from(statusCounts.values()) },
            department: { labels: deptLabels, data: deptData }
        },
        table: records
    };
}

function renderCharts(chartsData) {
    // Destroy existing charts to prevent canvas overlap issues when re-uploading
    if (trendChartInstance) trendChartInstance.destroy();
    if (statusChartInstance) statusChartInstance.destroy();
    if (deptChartInstance) deptChartInstance.destroy();

    // Line Chart: Trend
    const ctxTrend = document.getElementById('trendChart').getContext('2d');
    trendChartInstance = new Chart(ctxTrend, {
        type: 'line',
        data: {
            labels: chartsData.trend.labels,
            datasets: [{
                label: 'Present Count',
                data: chartsData.trend.data,
                borderColor: '#0d6efd',
                backgroundColor: 'rgba(13, 110, 253, 0.1)',
                fill: true,
                tension: 0.3
            }]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });

    // Doughnut Chart: Status
    const ctxStatus = document.getElementById('statusChart').getContext('2d');
    statusChartInstance = new Chart(ctxStatus, {
        type: 'doughnut',
        data: {
            labels: chartsData.status.labels,
            datasets: [{
                data: chartsData.status.data,
                backgroundColor: ['#198754', '#dc3545', '#ffc107'] // Green, Red, Yellow
            }]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });

    // Bar Chart: Department
    const ctxDept = document.getElementById('deptChart').getContext('2d');
    deptChartInstance = new Chart(ctxDept, {
        type: 'bar',
        data: {
            labels: chartsData.department.labels,
            datasets: [{
                label: 'Attendance %',
                data: chartsData.department.data,
                backgroundColor: '#0dcaf0'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: { y: { beginAtZero: true, max: 100 } }
        }
    });
}

function escapeHtml(value) {
    const div = document.createElement('div');
    div.textContent = value == null ? '' : String(value);
    return div.innerHTML;
}

function populateTable(tableData) {
    const tbody = document.getElementById('tableBody');
    tbody.innerHTML = ''; // Clear old rows

    tableData.forEach(row => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${escapeHtml(row.Date)}</td>
            <td>${escapeHtml(row.Employee_ID)}</td>
            <td>${escapeHtml(row.Name)}</td>
            <td>${escapeHtml(row.Department)}</td>
            <td>
                <span class="badge ${getBadgeClass(row.Status)}">${escapeHtml(row.Status)}</span>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function getBadgeClass(status) {
    const s = (status || '').toLowerCase();
    if (s === 'present') return 'bg-success';
    if (s === 'absent') return 'bg-danger';
    return 'bg-warning text-dark'; // Leave
}

// Table Search Filter Logic
document.getElementById('searchInput').addEventListener('keyup', function() {
    const filter = this.value.toLowerCase();
    const rows = document.querySelectorAll('#tableBody tr');

    rows.forEach(row => {
        const nameCell = row.cells[2].innerText.toLowerCase();
        const deptCell = row.cells[3].innerText.toLowerCase();

        if (nameCell.includes(filter) || deptCell.includes(filter)) {
            row.style.display = '';
        } else {
            row.style.display = 'none';
        }
    });
});
