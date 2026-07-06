const {runScheduler} = require('../scheduler/strategies/schedulingAlgo')
const {validateTask, validateBlockedInterval} = require('../scheduler/validator')
const {createTask} = require('../models/task')
const {createBlockedInterval} = require('../models/blockedInterval')
const {resolveDependencies} = require('../scheduler/dependencyResolver')
const {buildFreeSlots} = require('../scheduler/freeSlotBuilder')
const taskRepository = require('../repositories/taskRepository')

// TODO(auth): once login is wired up, replace every `getUserId(req)` call
// below with `req.user.id` set by the auth middleware. Pulling it from the
// body/query for now is ONLY so the DB layer is testable via Postman before
// auth exists - it is not something to ship.
function getUserId(req) {
  // req.body is undefined on requests with no JSON body (GET/DELETE with no
  // payload) since express.json() only sets it when it actually parses
  // something - so req.body?.userId, not req.body.userId.
  return req.body?.userId || req.query.userId;
}

async function getAllTasks(req, res) {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(400).json({ error: 'userId is required (temporary, until auth is added)' });
    const tasks = await taskRepository.getAllTasksForUser(userId);
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
    const userId = getUserId(req);
    if (!userId) return res.status(400).json({ error: 'userId is required (temporary, until auth is added)' });
    const task = await taskRepository.getTaskById(req.params.id, userId);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    res.json({ task });
  } catch (error) {
    next(error);
  }
}

async function createNewTask(req, res, next) {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(400).json({ error: 'userId is required (temporary, until auth is added)' });

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
    const userId = getUserId(req);
    if (!userId) return res.status(400).json({ error: 'userId is required (temporary, until auth is added)' });

    const task = await taskRepository.updateTask(req.params.id, userId, req.body);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    res.json({ task });
  } catch (error) {
    next(error);
  }
}

async function deleteTaskById(req, res, next) {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(400).json({ error: 'userId is required (temporary, until auth is added)' });

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
