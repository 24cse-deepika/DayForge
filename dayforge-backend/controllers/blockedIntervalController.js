const { validateBlockedInterval } = require('../scheduler/validator');
const blockedIntervalRepository = require('../repositories/blockedIntervalRepository');

async function getAllBlockedIntervals(req, res, next) {
  try {
    const userId = req.user.id;
    // if (!userId) return res.status(400).json({ error: 'userId is required (temporary, until auth is added)' });
    const blockedIntervals = await blockedIntervalRepository.getAllBlockedIntervalsForUser(userId);
    res.json({ blockedIntervals });
  } catch (error) {
    next(error);
  }
}

async function getBlockedIntervalFromId(req, res, next) {
  try {
    const userId = req.user.id;
    // if (!userId) return res.status(400).json({ error: 'userId is required (temporary, until auth is added)' });
    const blockedInterval = await blockedIntervalRepository.getBlockedIntervalById(req.params.id, userId);
    if (!blockedInterval) return res.status(404).json({ error: 'Blocked interval not found' });
    res.json({ blockedInterval });
  } catch (error) {
    next(error);
  }
}

async function createNewBlockedInterval(req, res, next) {
  try {
    const userId = req.user.id;
    // if (!userId) return res.status(400).json({ error: 'userId is required (temporary, until auth is added)' });

    const { success, error } = validateBlockedInterval(req.body);
    if (!success) {
      return res.status(400).json({ error: `Blocked interval validation failed - ${error.message || JSON.stringify(error)}` });
    }

    const blockedInterval = await blockedIntervalRepository.createBlockedIntervalRecord({ ...req.body, userId });
    res.status(201).json({ blockedInterval });
  } catch (error) {
    next(error);
  }
}

async function updateBlockedIntervalById(req, res, next) {
  try {
    const userId = req.user.id;
    // if (!userId) return res.status(400).json({ error: 'userId is required (temporary, until auth is added)' });

    const blockedInterval = await blockedIntervalRepository.updateBlockedInterval(req.params.id, userId, req.body);
    if (!blockedInterval) return res.status(404).json({ error: 'Blocked interval not found' });
    res.json({ blockedInterval });
  } catch (error) {
    next(error);
  }
}

async function deleteBlockedIntervalById(req, res, next) {
  try {
    const userId = req.user.id;
    // if (!userId) return res.status(400).json({ error: 'userId is required (temporary, until auth is added)' });

    const deleted = await blockedIntervalRepository.deleteBlockedInterval(req.params.id, userId);
    if (!deleted) return res.status(404).json({ error: 'Blocked interval not found' });
    res.json({ message: `Blocked interval ${req.params.id} deleted` });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getAllBlockedIntervals,
  getBlockedIntervalFromId,
  createNewBlockedInterval,
  updateBlockedIntervalById,
  deleteBlockedIntervalById,
};