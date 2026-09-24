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
    originalHead: { type: String },
    newHead: { type: String, required: true },
    newTaxTreatment: { type: String },
    newSection: { type: String }
}, { timestamps: true });

// Ensure we only store one active override per description per client
overrideRuleSchema.index({ clientId: 1, description: 1 }, { unique: true });

export const OverrideRule = mongoose.model('OverrideRule', overrideRuleSchema);
