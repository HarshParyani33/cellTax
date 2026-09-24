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
    transactionDirection: {
        type: String,
        enum: ['Credit', 'Debit'],
        required: true,
    },
    itrHead: {
        type: String,
        default: null,
    },
    taxTreatment: {
        type: String,
        default: null,
    },
    relevantSection: {
        type: String,
        default: null,
    },
    reasoning: {
        type: String,
        default: null,
    },
    engine: {
        type: String,
        enum: ['Rules Engine', 'LLM'],
        default: 'LLM',
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
