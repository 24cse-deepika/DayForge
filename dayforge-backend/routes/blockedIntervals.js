const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/authMiddleware');

const {
    getAllBlockedIntervals,
    getBlockedIntervalFromId,
    createNewBlockedInterval,
    updateBlockedIntervalById,
    deleteBlockedIntervalById
} = require('../controllers/blockedIntervalController');

router.use(authenticate);

router.get('/', getAllBlockedIntervals);
router.get('/:id', getBlockedIntervalFromId);
router.post('/', createNewBlockedInterval);
router.patch('/:id', updateBlockedIntervalById);
router.delete('/:id', deleteBlockedIntervalById);

module.exports = router;