const {runScheduler} = require('../scheduler/strategies/schedulingAlgo')
const {validateTask, validateBlockedInterval} = require('../scheduler/validator')
const {createTask} = require('../models/task')
const {createBlockedInterval} = require('../models/blockedInterval')
const {resolveDependencies} = require('../scheduler/dependencyResolver')
const {buildFreeSlots} = require('../scheduler/freeSlotBuilder')
const taskRepository = require('../repositories/taskRepository')

async function getAllTasks(req, res, next) {
  try {
    const tasks = await taskRepository.getAllTasksForUser(req.user.id);
    res.json({ tasks });
  } catch (error) {
    next(error);
  }
}

function scheduleTask(req, res) {
  const { tasks, blockedIntervals } = req.body;
  const fromTime = new Date(req.body.fromTime);

  try {
    // 1. Validate input
    for (const raw of tasks) {
      const { success, error } = validateTask(raw);
      if (!success) throw new Error(`Task validation failed: "${raw.name}" - ${error.message || JSON.stringify(error)}`);
    }
    for (const raw of blockedIntervals) {
      const { success, error } = validateBlockedInterval(raw);
      if (!success) throw new Error(`Blocked interval validation failed: "${raw.label}" - ${error.message || JSON.stringify(error)}`);
    }

    // 2. Build runtime objects
    const taskObjects = tasks.map(createTask);
    const blockedIntervalObjects = blockedIntervals.map(createBlockedInterval);

    // 3. Resolve dependencies
    const depResult = resolveDependencies(taskObjects);
    if (!depResult.success) throw new Error(`Dependency resolution failed - ${depResult.error.message || JSON.stringify(depResult.error)}`);
    const { readyQueue, adj } = depResult;

    // 4. Build free slots
    const furthestDeadline = new Date(Math.max(...taskObjects.map(t => t.deadline.getTime())));
    const { hardSlots, softSlots } = buildFreeSlots(blockedIntervalObjects, fromTime, furthestDeadline);

    // 5. Run scheduler
    const scheduleResult = runScheduler(taskObjects, readyQueue, adj, hardSlots, softSlots, fromTime);

    console.log('scheduleResult:', JSON.stringify(scheduleResult, null, 2));

    return res.json({
      scheduledTasks: scheduleResult.scheduledTasks,
      atRiskTasks: scheduleResult.atRiskTasks
    });

  } catch (error) {
    return res.status(400).json({ error: error.message });
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