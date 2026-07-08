const {runScheduler} = require('../scheduler/strategies/schedulingAlgo')
const {validateTask, validateBlockedInterval} = require('../scheduler/validator')
const {createTask} = require('../models/task')
const {createBlockedInterval} = require('../models/blockedInterval')
const {resolveDependencies} = require('../scheduler/dependencyResolver')
const {buildFreeSlots} = require('../scheduler/freeSlotBuilder')
const taskRepository = require('../repositories/taskRepository')
const blockedIntervalRepository = require('../repositories/blockedIntervalRepository')

async function getAllTasks(req, res, next) {
  try {
    const tasks = await taskRepository.getAllTasksForUser(req.user.id);
    res.json({ tasks });
  } catch (error) {
    next(error);
  }
}

async function scheduleTask(req, res, next) {
  try {
    const userId = req.user.id;
    const fromTime = new Date(req.body.fromTime);

    const tasks = await taskRepository.getAllTasksForUser(userId);
    const blockedIntervals = await blockedIntervalRepository.getAllBlockedIntervalsForUser(userId);

    // A task with no earliestStart means "no constraint — can start any time
    // from now." The engine (findSlot/scoreTask) assumes earliestStart is
    // always a real Date, so we normalize the missing case here, at the
    // single seam between user input and the scheduler, rather than inside
    // the engine itself.
    const taskObjects = tasks.map(t => ({
      ...t,
      task_status: t.taskStatus,
      earliestStart: t.earliestStart || fromTime,
    }));
    const blockedIntervalObjects = blockedIntervals;

    const depResult = resolveDependencies(taskObjects);
    if (!depResult.success) throw new Error(`Dependency resolution failed - ${depResult.error.message || JSON.stringify(depResult.error)}`);
    const { readyQueue, adj } = depResult;

    const furthestDeadline = new Date(Math.max(...taskObjects.map(t => t.deadline.getTime())));
    const { hardSlots, softSlots } = buildFreeSlots(blockedIntervalObjects, fromTime, furthestDeadline);

    const scheduleResult = runScheduler(taskObjects, readyQueue, adj, hardSlots, softSlots, fromTime);

    // Persist the engine's output — scheduledSlots and the post-scheduling
    // status/duration — back to Postgres so a page refresh doesn't lose it.
    const allTasks = [...scheduleResult.scheduledTasks, ...scheduleResult.atRiskTasks];
    await Promise.all(
      allTasks.map(t =>
        taskRepository.updateTask(t.id, userId, {
          taskStatus: t.task_status,
          duration: t.duration,
          scheduledSlots: t.scheduledSlots,
          progress: t.progress,
        })
      )
    );

    // Strip the stale pre-scheduling `taskStatus` copy before responding —
    // `task_status` (set by the engine) is the only one worth trusting.
    const clean = (t) => {
      const { taskStatus, ...rest } = t;
      return rest;
    };

    return res.json({
      scheduledTasks: scheduleResult.scheduledTasks.map(clean),
      atRiskTasks: scheduleResult.atRiskTasks.map(clean)
    });
  } catch (error) {
    next(error);
  }
}

async function getTaskFromId(req, res, next) {
  try {
    const userId = req.user.id;
    const task = await taskRepository.getTaskById(req.params.id, userId);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    res.json({ task });
  } catch (error) {
    next(error);
  }
}

async function createNewTask(req, res, next) {
  try {
    const userId = req.user.id;

    const { success, error } = validateTask(req.body);
    if (!success) {
      return res.status(400).json({ error: `Task validation failed - ${error.message || JSON.stringify(error)}` });
    }

    const task = await taskRepository.createTaskRecord({ ...req.body, userId });
    res.status(201).json({ task });
  } catch (error) {
    next(error);
  }
}

async function updateTaskById(req, res, next) {
  try {
    const userId = req.user.id;

    const task = await taskRepository.updateTask(req.params.id, userId, req.body);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    res.json({ task });
  } catch (error) {
    next(error);
  }
}

async function deleteTaskById(req, res, next) {
  try {
    const userId = req.user.id;

    const deleted = await taskRepository.deleteTask(req.params.id, userId);
    if (!deleted) return res.status(404).json({ error: 'Task not found' });
    res.json({ message: `Task ${req.params.id} deleted` });
  } catch (error) {
    next(error);
  }
}

module.exports = {
    getAllTasks,
    scheduleTask,
    getTaskFromId,
    createNewTask,
    updateTaskById,
    deleteTaskById
}