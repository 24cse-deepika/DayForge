const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/authMiddleware');
const { handleValidationErrors } = require('../middleware/validationMiddleware');
const {
    taskIdParamValidator,
    createTaskValidators,
    updateTaskValidators,
    scheduleValidators,
} = require('../validators/taskValidators');

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
router.post('/schedule', scheduleValidators, handleValidationErrors, scheduleTask);
router.get('/:id', taskIdParamValidator, handleValidationErrors, getTaskFromId);
router.post('/', createTaskValidators, handleValidationErrors, createNewTask);
router.patch('/:id', updateTaskValidators, handleValidationErrors, updateTaskById);
router.delete('/:id', taskIdParamValidator, handleValidationErrors, deleteTaskById);

module.exports = router;

