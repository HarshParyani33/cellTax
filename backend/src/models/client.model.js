import mongoose, { Schema } from 'mongoose';

const clientSchema = new Schema({
    caId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    name: {
        type: String,
        required: true,
        trim: true,
    },
    pan: {
        type: String,
        required: true,
        trim: true,
        uppercase: true,
    },
    aadhaar: {
        type: String,
        trim: true,
    }
}, {
    timestamps: true
});

export const Client = mongoose.model('Client', clientSchema);
