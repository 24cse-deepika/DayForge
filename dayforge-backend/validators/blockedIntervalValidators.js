const { body, param } = require('express-validator');
const { RECURRENCE, BLOCK_TYPES } = require('../utils/constants');

const blockedIntervalIdParamValidator = [
  param('id').isUUID().withMessage('Blocked interval id must be a valid UUID'),
];

const createBlockedIntervalValidators = [
  body('label').isString().withMessage('label must be a string').bail().trim().notEmpty().withMessage('label is required'),
  body('start').isISO8601().withMessage('start must be a valid ISO8601 date'),
  body('end').isISO8601().withMessage('end must be a valid ISO8601 date'),
  body('recurrence')
    .optional()
    .isIn(Object.values(RECURRENCE))
    .withMessage(`recurrence must be one of: ${Object.values(RECURRENCE).join(', ')}`),
  body('type')
    .optional()
    .isIn(Object.values(BLOCK_TYPES))
    .withMessage(`type must be one of: ${Object.values(BLOCK_TYPES).join(', ')}`),
  body('customDays').optional().isArray().withMessage('customDays must be an array'),
];

const updateBlockedIntervalValidators = [
  ...blockedIntervalIdParamValidator,
  body('label').optional().isString().withMessage('label must be a string').bail().trim().notEmpty(),
  body('start').optional().isISO8601(),
  body('end').optional().isISO8601(),
  body('recurrence').optional().isIn(Object.values(RECURRENCE)),
  body('type').optional().isIn(Object.values(BLOCK_TYPES)),
  body('customDays').optional().isArray(),
];

module.exports = {
  blockedIntervalIdParamValidator,
  createBlockedIntervalValidators,
  updateBlockedIntervalValidators,
};
