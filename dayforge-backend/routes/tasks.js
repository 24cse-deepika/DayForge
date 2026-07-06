const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/authMiddleware');

const {
    getAllTasks,
    scheduleTask,
    getTaskFromId,
    createNewTask,
    updateTaskById,
    deleteTaskById
} = require('../controllers/taskController');

router.use(authenticate);

router.get('/', getAllTasks);
router.post('/schedule', scheduleTask);
router.get('/:id', getTaskFromId);
router.post('/', createNewTask);
router.patch('/:id', updateTaskById);
router.delete('/:id', deleteTaskById);

module.exports = router;

