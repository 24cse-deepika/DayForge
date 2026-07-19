const { validationResult } = require('express-validator');

// Runs after an express-validator check chain (body(...)/param(...) etc.).
// If any checks failed, short-circuits with a 400 and a list of field-level
// errors instead of letting the request reach the controller.
//
// This is a shape/type gate only — deeper domain rules (deadline must be in
// the future, minSplitDuration < duration, start < end, etc.) still live in
// scheduler/validator.js and run inside the controllers, since those rules
// depend on relationships between fields that express-validator isn't a
// natural fit for.
function handleValidationErrors(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation failed',
      details: errors.array().map((e) => ({ field: e.path, message: e.msg })),
    });
  }
  next();
}

module.exports = { handleValidationErrors };
