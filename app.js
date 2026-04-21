// ── 設定 ────────────────────────────────────────────────
const SHEET_ID = '16l4JkuavXc3DtyKjNjXr-PUn78eDjWi0g-bFqMpNQ0U';
const CSV_URL  = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=0`;

// 若 Google Sheets 無法存取，使用圖片中的示範資料
const DEMO_DATA = [
  { date:'3/15', time:'9:00',  temp:22.5, humi:55 },
  { date:'3/15', time:'14:00', temp:26.8, humi:48 },
  { date:'3/16', time:'10:00', temp:23.1, humi:52 },
  { date:'3/17', time:'8:30',  temp:21.4, humi:60 },
  { date:'3/17', time:'15:00', temp:27.2, humi:45 },
  { date:'3/18', time:'11:00', temp:24.5, humi:50 },
  { date:'3/19', time:'9:15',  temp:22.8, humi:58 },
  { date:'3/20', time:'16:30', temp:26.5, humi:42 },
  { date:'3/21', time:'7:00',  temp:19.8, humi:65 },
  { date:'3/21', time:'13:00', temp:25.4, humi:50 },
  { date:'3/22', time:'10:30', temp:23.7, humi:53 },
  { date:'3/23', time:'9:00',  temp:22.1, humi:57 },
  { date:'3/23', time:'21:00', temp:20.5, humi:62 },
];

// ── 狀態 ────────────────────────────────────────────────
let allData   = [];
let metric    = 'both';   // both | temp | humi
let timePeriod = 'today'; // today | week | month
let chartType = 'line';   // line | bar | table
let chartObj  = null;

// ── 解析 CSV ─────────────────────────────────────────────
function parseCSV(csv) {
  const rows = csv.trim().split('\n').slice(1); // 跳過標頭
  return rows.map(r => {
    const cols = r.split(',');
    return {
      date: (cols[0] || '').trim(),
      time: (cols[1] || '').trim(),
      temp: parseFloat(cols[2]) || 0,
      humi: parseFloat((cols[3] || '').replace('%','')) || 0
    };
  }).filter(d => d.date && !isNaN(d.temp));
}

// ── 載入資料 ─────────────────────────────────────────────
function loadData() {
  $.ajax({
    url: CSV_URL,
    success: function(csv) {
      const parsed = parseCSV(csv);
      allData = parsed.length ? parsed : DEMO_DATA;
      render();
    },
    error: function() {
      allData = DEMO_DATA; // fallback
      render();
    }
  });
}

// ── 篩選時間 ──────────────────────────────────────────────
function filterByTime(data, period) {
  if (!data.length) return data;

  // 取得資料中最後一筆的日期作為「今天」
  const last = data[data.length - 1];
  const [lastM, lastD] = last.date.split('/').map(Number);
  const lastDateObj = new Date(2026, lastM - 1, lastD); // 年份假設2026

  if (period === 'today') {
    return data.filter(d => d.date === last.date);
  }
  if (period === 'week') {
    const weekAgo = new Date(lastDateObj);
    weekAgo.setDate(weekAgo.getDate() - 6);
    return data.filter(d => {
      const [m, day] = d.date.split('/').map(Number);
      const dt = new Date(2026, m - 1, day);
      return dt >= weekAgo && dt <= lastDateObj;
    });
  }
  if (period === 'month') {
    return data.filter(d => {
      const [m] = d.date.split('/').map(Number);
      return m === lastM;
    });
  }
  return data;
}

// ── 計算統計 ─────────────────────────────────────────────
function calcStats(data) {
  if (!data.length) return {};
  const temps = data.map(d => d.temp);
  const humis = data.map(d => d.humi);
  const avg = arr => (arr.reduce((a,b)=>a+b,0)/arr.length).toFixed(1);
  return {
    avgTemp: avg(temps),
    maxTemp: Math.max(...temps).toFixed(1),
    minTemp: Math.min(...temps).toFixed(1),
    avgHumi: avg(humis),
    maxHumi: Math.max(...humis).toFixed(0),
    minHumi: Math.min(...humis).toFixed(0)
  };
}

// ── 更新頂部即時數值 ──────────────────────────────────────
function updateCurrentValues(data) {
  const latest = data[data.length - 1] || allData[allData.length - 1];
  if (!latest) return;
  $('#cur-temp-val').text(latest.temp);
  $('#cur-humi-val').text(latest.humi);
  $('#last-update').text(`最後更新：${latest.date} ${latest.time}`);
}

// ── 更新統計摘要 ──────────────────────────────────────────
function updateStats(data) {
  const s = calcStats(data);
  $('#avg-temp').text(s.avgTemp ? s.avgTemp + ' °C' : '—');
  $('#max-temp').text(s.maxTemp ? s.maxTemp + ' °C' : '—');
  $('#min-temp').text(s.minTemp ? s.minTemp + ' °C' : '—');
  $('#avg-humi').text(s.avgHumi ? s.avgHumi + ' %' : '—');
  $('#max-humi').text(s.maxHumi ? s.maxHumi + ' %' : '—');
  $('#min-humi').text(s.minHumi ? s.minHumi + ' %' : '—');
}

// ── 渲染圖表 ─────────────────────────────────────────────
function renderChart(data) {
  if (chartObj) { chartObj.destroy(); chartObj = null; }
  $('#canvas-wrap').show();
  $('#table-wrap').hide();

  const labels = data.map(d => `${d.date} ${d.time}`);
  const datasets = [];

  if (metric === 'temp' || metric === 'both') {
    datasets.push({
      label: '溫度 (°C)',
      data: data.map(d => d.temp),
      borderColor: '#e8622a',
      backgroundColor: chartType === 'bar' ? 'rgba(232,98,42,.6)' : 'rgba(232,98,42,.1)',
      borderWidth: 2,
      tension: 0.35,
      fill: chartType === 'line',
      pointRadius: 3,
      yAxisID: 'y'
    });
  }
  if (metric === 'humi' || metric === 'both') {
    datasets.push({
      label: '濕度 (%)',
      data: data.map(d => d.humi),
      borderColor: '#3a82c4',
      backgroundColor: chartType === 'bar' ? 'rgba(58,130,196,.6)' : 'rgba(58,130,196,.1)',
      borderWidth: 2,
      tension: 0.35,
      fill: chartType === 'line',
      pointRadius: 3,
      yAxisID: metric === 'both' ? 'y2' : 'y'
    });
  }

  const scales = {
    x: {
      ticks: { font: { size: 11 }, maxTicksLimit: 8, color: '#8a92a0' },
      grid: { color: '#e4e7ec' }
    },
    y: {
      position: 'left',
      ticks: { font: { size: 11 }, color: '#8a92a0' },
      grid: { color: '#e4e7ec' },
      title: {
        display: true,
        text: metric === 'humi' ? '濕度 (%)' : '溫度 (°C)',
        color: '#8a92a0', font: { size: 11 }
      }
    }
  };

  if (metric === 'both') {
    scales.y2 = {
      position: 'right',
      ticks: { font: { size: 11 }, color: '#3a82c4' },
      grid: { drawOnChartArea: false },
      title: { display: true, text: '濕度 (%)', color: '#3a82c4', font: { size: 11 } }
    };
  }

  chartObj = new Chart(document.getElementById('main-chart'), {
    type: chartType === 'bar' ? 'bar' : 'line',
    data: { labels, datasets },
    options: {
      responsive: true,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { labels: { font: { size: 12 }, color: '#1a1d23' } }
      },
      scales
    }
  });
}

// ── 渲染資料表 ────────────────────────────────────────────
function renderTable(data) {
  if (chartObj) { chartObj.destroy(); chartObj = null; }
  $('#canvas-wrap').hide();
  $('#table-wrap').show();

  const tbody = $('#data-table tbody').empty();
  data.forEach(d => {
    tbody.append(`<tr>
      <td>${d.date}</td>
      <td>${d.time}</td>
      <td style="color:#e8622a;font-weight:500">${d.temp}</td>
      <td style="color:#3a82c4;font-weight:500">${d.humi}%</td>
    </tr>`);
  });
}

// ── 主渲染 ───────────────────────────────────────────────
function render() {
  const filtered = filterByTime(allData, timePeriod);
  updateCurrentValues(filtered);
  updateStats(filtered);
  if (chartType === 'table') {
    renderTable(filtered);
  } else {
    renderChart(filtered);
  }
}

// ── 按鈕事件 ─────────────────────────────────────────────
$(document).ready(function() {

  // 指標按鈕
  $('[data-metric]').on('click', function() {
    $('[data-metric]').removeClass('active');
    $(this).addClass('active');
    metric = $(this).data('metric');
    render();
  });

  // 時間按鈕
  $('[data-time]').on('click', function() {
    $('[data-time]').removeClass('active');
    $(this).addClass('active');
    timePeriod = $(this).data('time');
    render();
  });

  // 圖形按鈕
  $('[data-chart]').on('click', function() {
    $('[data-chart]').removeClass('active');
    $(this).addClass('active');
    chartType = $(this).data('chart');
    render();
  });

  // 載入資料
  loadData();
});
