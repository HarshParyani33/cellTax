import mongoose, { Schema } from 'mongoose';

const auditLogSchema = new Schema({
    transactionId: {
        type: Schema.Types.ObjectId,
        ref: 'Transaction',
        required: true,
    },
    caId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    originalCategory: {
        type: String,
        default: null,
    },
    newCategory: {
        type: String,
        required: true,
    }
}, {
    timestamps: true
});

export const AuditLog = mongoose.model('AuditLog', auditLogSchema);
