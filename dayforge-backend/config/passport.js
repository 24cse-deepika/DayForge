const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const {
  findUserByEmail,
  findUserByGoogleId,
  createGoogleUser,
  updateUserGoogleId,
} = require("../repositories/userRepository");

// We are NOT using passport.session(), serializeUser, or deserializeUser.
// Passport here only performs the Google OAuth handshake.
// After that, we issue our own JWT and never touch Passport again.

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: `${process.env.BASE_URL}/auth/google/callback`,
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const email = profile.emails?.[0]?.value;
        const googleId = profile.id;

        if (!email) {
          return done(new Error("Google account has no email"), null);
        }

        // 1. Already linked to this Google account?
        let user = await findUserByGoogleId(googleId);
        if (user) return done(null, user);

        // 2. Existing local account with the same email? Link it.
        user = await findUserByEmail(email);
        if (user) {
          user = await updateUserGoogleId(user.id, googleId);
          return done(null, user);
        }

        // 3. Brand new user via Google.
        user = await createGoogleUser({ email, googleId });
        return done(null, user);
      } catch (err) {
        return done(err, null);
      }
    }
  )
);

module.exports = passport;