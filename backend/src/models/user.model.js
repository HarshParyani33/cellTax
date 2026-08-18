import mongoose, { Schema } from 'mongoose';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

const userSchema = new Schema({
    googleId: { type: String, unique: true, sparse: true },
    name:{
        type: String,
        required: true,
        trim: true,
    },
    email:{
        unique: true,
        required: true,
        type: String,
        trim: true,
    },
    password: {
        type: String,
        required: function() { return !this.googleId; } 
    },
    avatar:{
        type: String,
        default: 'default-avatar.png'
    },
    refreshToken:{
        type: String,
    }
},
{
    timestamps: true,
});

userSchema.pre("save", async function (next) {
    if(!this.isModified("password")) return next(); 
    this.password = await bcrypt.hash(this.password, 10);
    next();
});

userSchema.methods.isPasswordCorrect = async function(password){
    return await bcrypt.compare(password, this.password);
};

userSchema.methods.generateAccessToken = function() {
    return jwt.sign(
        {
            _id: this._id,
            email: this.email,
            name: this.name,
            googleId: this.googleId || null,
        },
        process.env.ACCESS_TOKEN_SECRET,
        {
            expiresIn: process.env.ACCESS_TOKEN_EXPIRY
        }
    );
}

userSchema.methods.generateRefreshToken = function() {
    return jwt.sign(
        {
            _id: this._id
        },
        process.env.REFRESH_TOKEN_SECRET,
        {
            expiresIn: process.env.REFRESH_TOKEN_EXPIRY
        }
    );
}

export const User = mongoose.model('User', userSchema);
