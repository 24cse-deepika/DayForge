const {runScheduler} = require('../scheduler/strategies/schedulingAlgo')
const {validateTask, validateBlockedInterval} = require('../scheduler/validator')
const {createTask} = require('../models/task')
const {createBlockedInterval} = require('../models/blockedInterval')
const {resolveDependencies} = require('../scheduler/dependencyResolver')
const {buildFreeSlots} = require('../scheduler/freeSlotBuilder')

function getAllTasks(req, res) {
  // Logic to get all tasks for the logged-in user
  res.json({ message: 'Get all tasks' });
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

function getTaskFromId(req, res) {
    // Logic to get a task by ID
    res.json({ message: `Get task with id ${req.params.id}` });
}

function createNewTask(req, res) {
  // Logic to create a new task
  res.json({ message: 'Create new task' });
}

function updateTaskById(req, res) {
  // Logic to update a task by ID
  res.json({ message: `Update task with id ${req.params.id}` });
}

function deleteTaskById(req, res) {
  // Logic to delete a task by ID
  res.json({ message: `Delete task with id ${req.params.id}` });
}

module.exports = {
    getAllTasks,
    scheduleTask,
    getTaskFromId,
    createNewTask,
    updateTaskById,
    deleteTaskById
}
