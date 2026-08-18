import mongoose, { Schema } from 'mongoose';

const transactionSchema = new Schema({
    clientId: {
        type: Schema.Types.ObjectId,
        ref: 'Client',
        required: true,
    },
    date: {
        type: Date,
        required: true,
    },
    description: {
        type: String,
        required: true,
    },
    amount: {
        type: Number,
        required: true,
    },
    type: {
        type: String,
        enum: ['Credit', 'Debit'],
        required: true,
    },
    proposedCategory: {
        type: String,
        default: null,
    },
    confidenceScore: {
        type: Number,
        min: 0,
        max: 100,
        default: null,
    },
    aiReasoning: {
        type: String,
        default: null,
    },
    status: {
        type: String,
        enum: ['Pending', 'Approved', 'Overridden'],
        default: 'Pending',
    }
}, {
    timestamps: true
});

export const Transaction = mongoose.model('Transaction', transactionSchema);
