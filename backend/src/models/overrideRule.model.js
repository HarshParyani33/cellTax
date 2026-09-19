import mongoose from 'mongoose';

const overrideRuleSchema = new mongoose.Schema({
    clientId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Client',
        required: true
    },
    description: {
        type: String,
        required: true
    },
    originalCategory: {
        type: String
    },
    newCategory: {
        type: String,
        required: true
    }
}, { timestamps: true });

// Ensure we only store one active override per description per client
overrideRuleSchema.index({ clientId: 1, description: 1 }, { unique: true });

export const OverrideRule = mongoose.model('OverrideRule', overrideRuleSchema);
