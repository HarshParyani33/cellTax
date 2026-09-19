import { Transaction } from '../models/transaction.model.js';
import { CategoryRule } from '../models/categoryRule.model.js';
import { OverrideRule } from '../models/overrideRule.model.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';
import { categorizeTransactionsBatch } from '../utils/llm.service.js';

const processBatch = asyncHandler(async (req, res) => {
    const { clientId } = req.params;
    const { transactions } = req.body;

    if (!clientId) {
        throw new ApiError(400, "Client ID is required");
    }

    if (!transactions || !Array.isArray(transactions) || transactions.length === 0) {
        throw new ApiError(400, "An array of transactions is required in the body");
    }

    // Load all deterministic category rules
    const rules = await CategoryRule.find({});
    // Load CA's past overrides for this client
    const overrides = await OverrideRule.find({ clientId });

    const processedTransactions = [];
    const unclassifiedBatch = [];

    // Step 1: Run deterministic rules & overrides
    transactions.forEach(txn => {
        let proposedCategory = null;
        let confidenceScore = null;
        let aiReasoning = null;
        
        const descLower = (txn.description || "").toLowerCase();
        
        // Check Overrides first (highest priority)
        const matchedOverride = overrides.find(o => o.description.toLowerCase() === descLower);
        if (matchedOverride) {
            proposedCategory = matchedOverride.newCategory;
            confidenceScore = 1.0;
            aiReasoning = `Matched your past correction -> ${matchedOverride.newCategory}`;
        } else {
            // Check deterministic rules
            for (const rule of rules) {
                if (descLower.includes(rule.keyword.toLowerCase())) {
                    proposedCategory = rule.category;
                    confidenceScore = rule.confidence;
                    aiReasoning = `Matched rule: "${rule.keyword}" -> ${rule.category}`;
                    break;
                }
            }
        }

        const processedTxn = {
            clientId,
            date: txn.date ? new Date(txn.date) : new Date(), 
            description: txn.description || "Unknown",
            amount: Number(txn.amount) || 0,
            type: txn.type || "Debit",
            proposedCategory,
            confidenceScore,
            aiReasoning,
            status: 'Pending',
            _originalIndex: processedTransactions.length
        };

        processedTransactions.push(processedTxn);

        if (!proposedCategory || confidenceScore < 0.8) {
            unclassifiedBatch.push({
                index: processedTxn._originalIndex,
                description: processedTxn.description,
                amount: processedTxn.amount,
                type: processedTxn.type
            });
        }
    });

    // Step 2: Call LLM for unclassified transactions with Few-Shot context
    if (unclassifiedBatch.length > 0) {
        console.log(`Sending ${unclassifiedBatch.length} transactions to LLM...`);
        const llmPayload = unclassifiedBatch.map(t => ({
            description: t.description,
            amount: t.amount,
            type: t.type
        }));

        // Format overrides for the LLM to learn from
        const pastOverridesContext = overrides.map(o => ({
            description: o.description,
            category: o.newCategory
        }));

        const llmResults = await categorizeTransactionsBatch(llmPayload, pastOverridesContext);

        if (llmResults && llmResults.length === unclassifiedBatch.length) {
            unclassifiedBatch.forEach((unclassified, i) => {
                const llmCategory = llmResults[i];
                const targetTxn = processedTransactions[unclassified.index];
                
                targetTxn.proposedCategory = llmCategory.category || "Uncategorized";
                targetTxn.confidenceScore = llmCategory.confidence || 0.5;
                targetTxn.aiReasoning = `LLM: ${llmCategory.reasoning || 'No reasoning provided'}`;
            });
        } else {
            console.warn("LLM results count mismatch or failure. Using fallback.");
            unclassifiedBatch.forEach((unclassified) => {
                const targetTxn = processedTransactions[unclassified.index];
                targetTxn.proposedCategory = targetTxn.proposedCategory || "Uncategorized";
                targetTxn.confidenceScore = targetTxn.confidenceScore || 0;
                targetTxn.aiReasoning = targetTxn.aiReasoning || "LLM processing failed.";
            });
        }
    }

    const finalTransactions = processedTransactions.map(({ _originalIndex, ...rest }) => rest);
    const inserted = await Transaction.insertMany(finalTransactions);

    return res.status(201).json(
        new ApiResponse(201, inserted, `${inserted.length} transactions processed and saved`)
    );
});

const saveOverride = asyncHandler(async (req, res) => {
    const { clientId, description, originalCategory, newCategory } = req.body;

    if (!clientId || !description || !newCategory) {
        throw new ApiError(400, "clientId, description, and newCategory are required");
    }

    // Upsert the override rule
    const rule = await OverrideRule.findOneAndUpdate(
        { clientId, description: description.trim() },
        { originalCategory, newCategory },
        { upsert: true, new: true }
    );

    return res.status(200).json(new ApiResponse(200, rule, "Override rule saved for future learning"));
});

export { processBatch, saveOverride };
