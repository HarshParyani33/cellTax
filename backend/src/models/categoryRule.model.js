import mongoose, { Schema } from 'mongoose';

const categoryRuleSchema = new Schema({
    keyword: {
        type: String,
        required: true,
        trim: true,
    },
    category: {
        type: String,
        required: true,
        trim: true,
    },
    confidence: {
        type: Number,
        required: true,
        min: 0,
        max: 100,
    }
}, {
    timestamps: true
});

export const CategoryRule = mongoose.model('CategoryRule', categoryRuleSchema);
