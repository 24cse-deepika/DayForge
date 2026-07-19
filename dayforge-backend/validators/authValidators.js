const { body } = require('express-validator');

// Registration gets stricter checks since it's the one place a bad value
// (malformed email, trivially short password) gets permanently stored.
const registerValidators = [
  body('email').isEmail().withMessage('A valid email is required'),
  body('password')
    .isString()
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long'),
];

// Login only needs to confirm both fields are present and email-shaped —
// the actual credential check (does this password match this hash) is a
// business-logic concern handled in authController, not shape validation.
const loginValidators = [
  body('email').isEmail().withMessage('A valid email is required'),
  body('password').isString().notEmpty().withMessage('Password is required'),
];

module.exports = { registerValidators, loginValidators };