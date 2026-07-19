const { body, param } = require('express-validator');

// Shape/type checks only, run before a request reaches the controller.
// The domain-specific rules (deadline must be in the future, minSplitDuration
// must be less than total duration, etc.) still live in scheduler/validator.js
// and run inside taskController — this layer's job is just to reject
// malformed requests (wrong types, missing required fields, bad UUIDs)
// early, with a clear field-level error instead of a confusing 500.

const taskIdParamValidator = [
  param('id').isUUID().withMessage('Task id must be a valid UUID'),
];

const createTaskValidators = [
  body('name').isString().withMessage('name must be a string').bail().trim().notEmpty().withMessage('name is required'),
  body('durationMinutes')
    .isInt({ min: 1 })
    .withMessage('durationMinutes must be a positive integer'),
  body('deadline').isISO8601().withMessage('deadline must be a valid ISO8601 date'),
  body('priority')
    .isInt({ min: 1, max: 5 })
    .withMessage('priority must be an integer between 1 and 5'),
  body('splittable').isBoolean().withMessage('splittable must be a boolean'),
  body('minSplitDuration')
    .optional()
    .isInt({ min: 1 })
    .withMessage('minSplitDuration must be a positive integer'),
  body('earliestStart')
    .optional()
    .isISO8601()
    .withMessage('earliestStart must be a valid ISO8601 date'),
  body('dependencies').optional().isArray().withMessage('dependencies must be an array'),
  body('dependencies.*').optional().isUUID().withMessage('each dependency id must be a valid UUID'),
  body('category').optional().isString(),
];

const updateTaskValidators = [
  ...taskIdParamValidator,
  body('name').optional().isString().withMessage('name must be a string').bail().trim().notEmpty().withMessage('name is required'),
  body('durationMinutes').optional().isInt({ min: 1 }),
  body('deadline').optional().isISO8601(),
  body('priority').optional().isInt({ min: 1, max: 5 }),
  body('splittable').optional().isBoolean(),
  body('minSplitDuration').optional().isInt({ min: 1 }),
  body('earliestStart').optional().isISO8601(),
  body('dependencies').optional().isArray(),
  body('dependencies.*').optional().isUUID(),
  body('category').optional().isString(),
];

const scheduleValidators = [
  body('fromTime')
    .optional()
    .isISO8601()
    .withMessage('fromTime must be a valid ISO8601 date'),
];

module.exports = {
  taskIdParamValidator,
  createTaskValidators,
  updateTaskValidators,
  scheduleValidators,
};
