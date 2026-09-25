let trendChartInstance = null;
let statusChartInstance = null;
let deptChartInstance = null;

document.getElementById('uploadForm').addEventListener('submit', async function (e) {
    e.preventDefault();
    
    const fileInput = document.getElementById('csvFile');
    const alertDiv = document.getElementById('uploadAlert');
    const dashboardContent = document.getElementById('dashboardContent');
    
    if (fileInput.files.length === 0) return;

    const formData = new FormData();
    formData.append('file', fileInput.files[0]);

    // Show loading state
    alertDiv.innerHTML = '<div class="alert alert-info">Processing data...</div>';

    try {
        const response = await fetch('/upload', {
            method: 'POST',
            body: formData
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'An error occurred during file upload.');
        }

        alertDiv.innerHTML = ''; // Clear loading alert
        dashboardContent.classList.remove('d-none'); // Reveal dashboard

        // 1. Update KPIs
        document.getElementById('kpi-employees').innerText = data.kpis.total_employees;
        document.getElementById('kpi-avg').innerText = data.kpis.avg_attendance + '%';
        document.getElementById('kpi-present').innerText = data.kpis.total_present;
        document.getElementById('kpi-absent').innerText = data.kpis.total_absent;

        // 2. Render Charts
        renderCharts(data.charts);

        // 3. Populate Table
        populateTable(data.table);

    } catch (error) {
        alertDiv.innerHTML = `<div class="alert alert-danger">${error.message}</div>`;
        dashboardContent.classList.add('d-none');
    }
});

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

function populateTable(tableData) {
    const tbody = document.getElementById('tableBody');
    tbody.innerHTML = ''; // Clear old rows

    tableData.forEach(row => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${row.Date}</td>
            <td>${row.Employee_ID}</td>
            <td>${row.Name}</td>
            <td>${row.Department}</td>
            <td>
                <span class="badge ${getBadgeClass(row.Status)}">${row.Status}</span>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function getBadgeClass(status) {
    const s = status.toLowerCase();
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