import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { User } from '../models/user.model.js';

// Google
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: `${process.env.BACKEND_URL || 'http://localhost:8000'}/api/v1/auth/google/callback`
}, async (accessToken, refreshToken, profile, done) => {
    try {
        let user = await User.findOne({ googleId: profile.id });
        
        if (!user) {
             const existingEmailUser = await User.findOne({ email: profile.emails[0].value });
             if (existingEmailUser) {
                 existingEmailUser.googleId = profile.id;
                 await existingEmailUser.save();
                 return done(null, existingEmailUser);
             }

            user = await User.create({
                googleId: profile.id,
                name: profile.displayName || 'Google User',
                email: profile.emails[0].value,
                avatar: profile.photos?.[0]?.value || 'default-avatar.png'
            });
        }
        return done(null, user);
    } catch (error) {
        return done(error, null);
    }
}));
