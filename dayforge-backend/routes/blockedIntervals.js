const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/authMiddleware');
const { handleValidationErrors } = require('../middleware/validationMiddleware');
const {
    blockedIntervalIdParamValidator,
    createBlockedIntervalValidators,
    updateBlockedIntervalValidators,
} = require('../validators/blockedIntervalValidators');

const {
    getAllBlockedIntervals,
    getBlockedIntervalFromId,
    createNewBlockedInterval,
    updateBlockedIntervalById,
    deleteBlockedIntervalById
} = require('../controllers/blockedIntervalController');

router.use(authenticate);

router.get('/', getAllBlockedIntervals);
router.get('/:id', blockedIntervalIdParamValidator, handleValidationErrors, getBlockedIntervalFromId);
router.post('/', createBlockedIntervalValidators, handleValidationErrors, createNewBlockedInterval);
router.patch('/:id', updateBlockedIntervalValidators, handleValidationErrors, updateBlockedIntervalById);
router.delete('/:id', blockedIntervalIdParamValidator, handleValidationErrors, deleteBlockedIntervalById);

module.exports = router;