const express = require('express');
const router = express.Router();

const {
    getAllBlockedIntervals,
    getBlockedIntervalFromId,
    createNewBlockedInterval,
    updateBlockedIntervalById,
    deleteBlockedIntervalById
} = require('../controllers/blockedIntervalController');

router.get('/', getAllBlockedIntervals);

router.get('/:id', getBlockedIntervalFromId);

router.post('/', createNewBlockedInterval);

router.patch('/:id', updateBlockedIntervalById);

router.delete('/:id', deleteBlockedIntervalById);

module.exports = router;