import { Router } from 'express';
import { 
    registerUser, 
    loginUser,
    generateAccessAndRefreshTokens,
    logoutUser,
    refreshAccessToken,
    getUserProfile
} from '../controllers/auth.controller.js';
import { verifyJWT }  from '../middlewares/auth.middleware.js';
import passport from 'passport';

const router = Router();

router.route("/register").post(registerUser);
router.route("/login").post(loginUser);
router.route("/refresh-token").post(refreshAccessToken);
router.route("/logout").post(verifyJWT, logoutUser);
router.route("/profile").get(verifyJWT, getUserProfile);

// Google OAuth
router.get("/google", passport.authenticate("google", { scope: ["profile", "email"] }));
router.get("/google/callback", 
    passport.authenticate("google", { session: false }), 
    async (req, res) => {
        const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(req.user._id);
        
        const options = { httpOnly: true, secure: process.env.NODE_ENV === 'production' };

        res.cookie("accessToken", accessToken, options)
           .cookie("refreshToken", refreshToken, options)
           .redirect(`${process.env.FRONTEND_URL}/dashboard`);
    }
);



export default router;
