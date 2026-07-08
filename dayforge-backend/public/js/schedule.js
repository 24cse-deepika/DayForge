// Schedule page logic: calls POST /api/tasks/schedule, then renders the
// result as a single-day timeline (Motion/TimeHero-style) with tabs to
// switch between the days the engine actually placed work on.

const HOUR_HEIGHT_PX = 60; // must match .timeline-hour-row height in style.css
let scheduleByDay = {}; // { 'YYYY-MM-DD': [ {task, start, end, reason} ] }
let sortedDayKeys = [];
let activeDayKey = null;

function dayKey(date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function dayLabel(key) {
  const [y, m, d] = key.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

function minutesSinceMidnight(date) {
  const d = new Date(date);
  return d.getHours() * 60 + d.getMinutes();
}

function startOfNextDay(date) {
  const d = new Date(date);
  d.setHours(24, 0, 0, 0);
  return d;
}

// A scheduled slot can span past midnight (e.g. 11:30 PM -> 1:00 AM).
// Split it at each day boundary it crosses so every affected day's
// timeline shows the correct portion, instead of silently clipping
// whatever falls after midnight.
function addSlotToDayBuckets(task, slot) {
  let segmentStart = new Date(slot.start);
  const slotEnd = new Date(slot.end);

  while (segmentStart < slotEnd) {
    const boundary = startOfNextDay(segmentStart);
    const segmentEnd = boundary < slotEnd ? boundary : slotEnd;

    const key = dayKey(segmentStart);
    if (!scheduleByDay[key]) scheduleByDay[key] = [];
    scheduleByDay[key].push({
      task,
      start: segmentStart,
      end: segmentEnd,
      reason: slot.reason,
    });

    segmentStart = segmentEnd;
  }
}

function buildHourGrid() {
  const hoursEl = document.getElementById('timelineHours');
  const trackEl = document.getElementById('timelineTrack');

  let hoursHtml = '';
  let rowsHtml = '';
  for (let h = 0; h < 24; h++) {
    const label = new Date(2000, 0, 1, h).toLocaleTimeString(undefined, { hour: 'numeric' });
    hoursHtml += `<div class="timeline-hour-label">${label}</div>`;
    rowsHtml += `<div class="timeline-hour-row"></div>`;
  }
  hoursEl.innerHTML = hoursHtml;
  trackEl.innerHTML = rowsHtml;
  trackEl.style.height = `${24 * HOUR_HEIGHT_PX}px`;
}

function renderDayTabs() {
  const tabsEl = document.getElementById('dayTabs');

  if (!sortedDayKeys.length) {
    tabsEl.innerHTML = '';
    return;
  }

  tabsEl.innerHTML = sortedDayKeys.map((key) => {
    const count = scheduleByDay[key].length;
    const activeClass = key === activeDayKey ? 'active' : '';
    return `<button type="button" class="day-tab ${activeClass}" data-day="${key}">${dayLabel(key)}<span class="tab-count">${count}</span></button>`;
  }).join('');

  tabsEl.querySelectorAll('.day-tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      activeDayKey = btn.dataset.day;
      renderDayTabs();
      renderBlocksForActiveDay();
    });
  });
}

function renderBlocksForActiveDay() {
  const trackEl = document.getElementById('timelineTrack');
  // Clear any previously rendered blocks, keep the hour-row grid lines.
  trackEl.querySelectorAll('.schedule-block').forEach((el) => el.remove());

  const entries = activeDayKey ? (scheduleByDay[activeDayKey] || []) : [];

  entries.forEach(({ task, start, end, reason }) => {
    const top = minutesSinceMidnight(start);
    const heightMinutes = Math.max((new Date(end).getTime() - new Date(start).getTime()) / 60000, 15);

    const block = document.createElement('div');
    block.className = `schedule-block p-${task.priority}`;
    block.style.top = `${top}px`;
    block.style.height = `${heightMinutes}px`;
    block.title = reason ? `${task.name} — ${reason}` : task.name;
    block.innerHTML = `
      <div class="block-title">${escapeHtml(task.name)}</div>
      <div class="block-time">${formatTime(start)} – ${formatTime(end)}</div>
    `;
    trackEl.appendChild(block);
  });
}

function formatTime(value) {
  return new Date(value).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

function renderAtRisk(atRiskTasks) {
  const listEl = document.getElementById('atRiskList');

  if (!atRiskTasks.length) {
    listEl.innerHTML = '<div class="empty-state"><div class="display">Nothing at risk</div><p>Every task fit somewhere in the schedule.</p></div>';
    return;
  }

  listEl.innerHTML = atRiskTasks.map((t) => `
    <div class="list-item">
      <div class="item-main">
        <div class="item-name">${escapeHtml(t.taskName)}</div>
        <div class="item-meta">${escapeHtml(t.reason)}</div>
      </div>
    </div>
  `).join('');
}

// Builds scheduleByDay/sortedDayKeys/activeDayKey from a list of tasks
// (each optionally carrying scheduledSlots) and renders the result. Used
// both right after generating a fresh schedule and when restoring the
// last-persisted one on page load.
function populateScheduleFromTasks(tasks) {
  scheduleByDay = {};
  (tasks || []).forEach((task) => {
    (task.scheduledSlots || []).forEach((slot) => {
      addSlotToDayBuckets(task, slot);
    });
  });

  sortedDayKeys = Object.keys(scheduleByDay).sort();
  activeDayKey = sortedDayKeys[0] || null;

  renderDayTabs();
  renderBlocksForActiveDay();
}

// The backend persists scheduledSlots on every task row, so a page reload
// shouldn't lose the last-generated schedule — only the "at risk" list is
// ephemeral (it's never saved), so that stays at its default state until
// the next "Generate Schedule" click.
async function loadPersistedSchedule() {
  try {
    const res = await fetch('/api/tasks', { credentials: 'include' });
    if (!res.ok) return;
    const data = await res.json();
    populateScheduleFromTasks(data.tasks || []);
  } catch (err) {
    // Non-fatal — the user can still click "Generate Schedule".
  }
}

function showScheduleError(message) {
  const banner = document.getElementById('scheduleError');

  if(!banner){
    console.warn("Schedule error banner element not found.");
    return;
  }

  banner.textContent = message;
  banner.style.display = 'block';
}

function hideScheduleError() {
  const banner = document.getElementById('scheduleError');
  if (!banner) {
    console.warn("Schedule error banner element not found.");
    return;
  }

  banner.style.display = 'none';
}

async function generateSchedule() {
  const btn = document.getElementById('generateBtn');
  const fromTimeInput = document.getElementById('fromTime');
  btn.disabled = true;
  btn.textContent = 'Generating…';

  try {
    const fromTime = fromTimeInput.value ? new Date(fromTimeInput.value) : new Date();

    const res = await fetch('/api/tasks/schedule', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ fromTime: fromTime.toISOString() }),
    });

    const data = await res.json();
    if (!res.ok) {
      showScheduleError(data.error || 'Could not generate a schedule.');
      return;
    }

    // Flatten every scheduledSlot into per-day buckets for the timeline,
    // splitting any slot that crosses midnight across the days it spans.
    populateScheduleFromTasks(data.scheduledTasks);
    renderAtRisk(data.atRiskTasks || []);

    if (!sortedDayKeys.length) {
      showScheduleError('No tasks could be scheduled. Add some tasks on the Dashboard first, or check that you have free time between your blocked intervals.');
    }
  } catch (err) {
    showScheduleError('Could not reach the server. Check your connection and try again.');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Generate Schedule';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  buildHourGrid();
  document.getElementById('fromTime').value = toDatetimeLocalValue(new Date());
  document.getElementById('generateBtn').addEventListener('click', generateSchedule);
  loadPersistedSchedule();
});
