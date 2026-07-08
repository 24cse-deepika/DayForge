// Dashboard page logic: loads and renders tasks + blocked intervals,
// and wires up the two "add" forms to the API.

const PRIORITY_LABELS = { 5: 'Critical', 4: 'High', 3: 'Medium', 2: 'Low', 1: 'Minimal' };

let currentTasks = [];

function formatDateTime(value) {
  if (!value) return '';
  const d = new Date(value);
  return d.toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}

function showError(bannerEl, message) {
  bannerEl.textContent = message;
  bannerEl.style.display = 'block';
}

function hideError(bannerEl) {
  bannerEl.style.display = 'none';
}

/* ---------------------------------------------------------------- */
/* Tasks                                                             */
/* ---------------------------------------------------------------- */

async function loadTasks() {
  const listEl = document.getElementById('taskList');
  try {
    const res = await fetch('/api/tasks', { credentials: 'include' });
    if (!res.ok) throw new Error('Failed to load tasks');
    const data = await res.json();
    currentTasks = data.tasks || [];
    renderTaskList(currentTasks);
    populateDependencyOptions(currentTasks);
  } catch (err) {
    listEl.innerHTML = '<div class="empty-state"><div class="display">Couldn\'t load tasks</div><p>Refresh the page to try again.</p></div>';
  }
}

function renderTaskList(tasks) {
  const listEl = document.getElementById('taskList');

  if (!tasks.length) {
    listEl.innerHTML = '<div class="empty-state"><div class="display">No tasks yet</div><p>Add your first task above to get started.</p></div>';
    return;
  }

  listEl.innerHTML = tasks.map((task) => {
    const statusLabel = (task.taskStatus || task.task_status || 'pending').replace('_', ' ');
    const statusClass = `badge-status-${(task.taskStatus || task.task_status || 'pending')}`;
    const durationLabel = `${task.duration ?? task.originalDuration} min`;
    return `
      <div class="list-item" data-task-id="${task.id}">
        <div class="item-main">
          <div class="item-name">${escapeHtml(task.name)}</div>
          <div class="item-meta">
            ${durationLabel} · Due ${formatDateTime(task.deadline)}
            <span class="badge badge-priority-${task.priority}">P${task.priority}</span>
            <span class="badge ${statusClass}">${statusLabel}</span>
          </div>
        </div>
        <div class="item-actions">
          <button type="button" class="delete-task-btn" data-id="${task.id}">Delete</button>
        </div>
      </div>
    `;
  }).join('');

  listEl.querySelectorAll('.delete-task-btn').forEach((btn) => {
    btn.addEventListener('click', () => deleteTask(btn.dataset.id));
  });
}

function populateDependencyOptions(tasks) {
  const select = document.getElementById('taskDependencies');
  select.innerHTML = tasks.map((t) => `<option value="${t.id}">${escapeHtml(t.name)}</option>`).join('');
}

async function deleteTask(id) {
  try {
    const res = await fetch(`/api/tasks/${id}`, { method: 'DELETE', credentials: 'include' });
    if (!res.ok) throw new Error('Failed to delete task');
    await loadTasks();
  } catch (err) {
    showError(document.getElementById('taskError'), 'Could not delete that task. Try again.');
  }
}

function setupTaskForm() {
  const form = document.getElementById('taskForm');
  const errorBanner = document.getElementById('taskError');
  const splittableCheckbox = document.getElementById('taskSplittable');
  const minSplitField = document.getElementById('minSplitField');

  splittableCheckbox.addEventListener('change', () => {
    minSplitField.classList.toggle('is-visible', splittableCheckbox.checked);
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideError(errorBanner);

    const dependencies = Array.from(document.getElementById('taskDependencies').selectedOptions).map((o) => o.value);

    const payload = {
      name: document.getElementById('taskName').value.trim(),
      durationMinutes: Number(document.getElementById('taskDuration').value),
      priority: Number(document.getElementById('taskPriority').value),
      // Send the datetime-local value as-is (no timezone conversion): the
      // `deadline` column is TIMESTAMP WITHOUT TIME ZONE, so Postgres would
      // otherwise store the raw UTC digits as if they were local time,
      // shifting the deadline by the browser's UTC offset.
      deadline: document.getElementById('taskDeadline').value,
      splittable: splittableCheckbox.checked,
      category: document.getElementById('taskCategory').value.trim() || null,
      dependencies,
    };

    const earliestStart = document.getElementById('taskEarliestStart').value;
    if (earliestStart) payload.earliestStart = earliestStart;

    if (payload.splittable) {
      payload.minSplitDuration = Number(document.getElementById('taskMinSplit').value);
    }

    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;

    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (!res.ok) {
        showError(errorBanner, data.error || 'Could not add that task.');
        return;
      }

      form.reset();
      minSplitField.classList.remove('is-visible');
      await loadTasks();
    } catch (err) {
      showError(errorBanner, 'Could not reach the server. Check your connection and try again.');
    } finally {
      submitBtn.disabled = false;
    }
  });
}

/* ---------------------------------------------------------------- */
/* Blocked intervals                                                 */
/* ---------------------------------------------------------------- */

async function loadBlockedIntervals() {
  const listEl = document.getElementById('blockList');
  try {
    const res = await fetch('/api/blocked-intervals', { credentials: 'include' });
    if (!res.ok) throw new Error('Failed to load blocked intervals');
    const data = await res.json();
    renderBlockList(data.blockedIntervals || []);
  } catch (err) {
    listEl.innerHTML = '<div class="empty-state"><div class="display">Couldn\'t load blocked time</div><p>Refresh the page to try again.</p></div>';
  }
}

function renderBlockList(intervals) {
  const listEl = document.getElementById('blockList');

  if (!intervals.length) {
    listEl.innerHTML = '<div class="empty-state"><div class="display">No blocked time yet</div><p>Add sleep, classes, or other fixed commitments above.</p></div>';
    return;
  }

  const recurrenceLabels = { none: '', daily: 'Every day', weekdays: 'Weekdays', weekends: 'Weekends', custom: 'Custom days' };

  listEl.innerHTML = intervals.map((interval) => {
    const recurrenceLabel = recurrenceLabels[interval.recurrence] || '';
    return `
      <div class="list-item" data-interval-id="${interval.id}">
        <div class="item-main">
          <div class="item-name">${escapeHtml(interval.label)}</div>
          <div class="item-meta">
            ${formatDateTime(interval.start)} &rarr; ${formatDateTime(interval.end)}
            ${recurrenceLabel ? ' · ' + recurrenceLabel : ''}
            <span class="badge ${interval.type === 'break' ? 'badge-priority-2' : 'badge-priority-4'}">${interval.type}</span>
          </div>
        </div>
        <div class="item-actions">
          <button type="button" class="delete-block-btn" data-id="${interval.id}">Delete</button>
        </div>
      </div>
    `;
  }).join('');

  listEl.querySelectorAll('.delete-block-btn').forEach((btn) => {
    btn.addEventListener('click', () => deleteBlockedInterval(btn.dataset.id));
  });
}

async function deleteBlockedInterval(id) {
  try {
    const res = await fetch(`/api/blocked-intervals/${id}`, { method: 'DELETE', credentials: 'include' });
    if (!res.ok) throw new Error('Failed to delete blocked interval');
    await loadBlockedIntervals();
  } catch (err) {
    showError(document.getElementById('blockError'), 'Could not delete that blocked interval. Try again.');
  }
}

function setupBlockForm() {
  const form = document.getElementById('blockForm');
  const errorBanner = document.getElementById('blockError');
  const recurrenceSelect = document.getElementById('blockRecurrence');
  const customDaysField = document.getElementById('customDaysField');

  recurrenceSelect.addEventListener('change', () => {
    customDaysField.classList.toggle('is-visible', recurrenceSelect.value === 'custom');
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideError(errorBanner);

    const customDays = Array.from(form.querySelectorAll('input[name="customDays"]:checked')).map((c) => c.value);

    const payload = {
      label: document.getElementById('blockLabel').value.trim(),
      // Same reasoning as taskDeadline above — keep the local wall-clock
      // value intact for the TIMESTAMP WITHOUT TIME ZONE columns.
      start: document.getElementById('blockStart').value,
      end: document.getElementById('blockEnd').value,
      recurrence: recurrenceSelect.value,
      type: document.getElementById('blockType').value,
    };

    if (payload.recurrence === 'custom') {
      if (!customDays.length) {
        showError(errorBanner, 'Pick at least one day for a custom recurrence.');
        return;
      }
      payload.customDays = customDays;
    }

    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;

    try {
      const res = await fetch('/api/blocked-intervals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (!res.ok) {
        showError(errorBanner, data.error || 'Could not add that blocked time.');
        return;
      }

      form.reset();
      customDaysField.classList.remove('is-visible');
      await loadBlockedIntervals();
    } catch (err) {
      showError(errorBanner, 'Could not reach the server. Check your connection and try again.');
    } finally {
      submitBtn.disabled = false;
    }
  });
}

/* ---------------------------------------------------------------- */

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

document.addEventListener('DOMContentLoaded', () => {
  setupTaskForm();
  setupBlockForm();
  loadTasks();
  loadBlockedIntervals();
});