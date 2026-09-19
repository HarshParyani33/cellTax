import { Transaction } from '../models/transaction.model.js';
import { CategoryRule } from '../models/categoryRule.model.js';
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

    const processedTransactions = [];
    const unclassifiedBatch = [];

    // Step 1: Run deterministic rules
    transactions.forEach(txn => {
        let proposedCategory = null;
        let confidenceScore = null;
        let aiReasoning = null;
        
        const descLower = (txn.description || "").toLowerCase();
        
        for (const rule of rules) {
            if (descLower.includes(rule.keyword.toLowerCase())) {
                proposedCategory = rule.category;
                confidenceScore = rule.confidence;
                aiReasoning = `Matched rule: "${rule.keyword}" -> ${rule.category}`;
                break;
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
            _originalIndex: processedTransactions.length // Keep track to merge later
        };

        processedTransactions.push(processedTxn);

        // If no match or low confidence, queue for LLM
        if (!proposedCategory || confidenceScore < 0.8) {
            unclassifiedBatch.push({
                index: processedTxn._originalIndex,
                description: processedTxn.description,
                amount: processedTxn.amount,
                type: processedTxn.type
            });
        }
    });

    // Step 2: Call LLM for unclassified transactions
    if (unclassifiedBatch.length > 0) {
        console.log(`Sending ${unclassifiedBatch.length} transactions to LLM...`);
        // Map to just the fields the LLM needs to save tokens
        const llmPayload = unclassifiedBatch.map(t => ({
            description: t.description,
            amount: t.amount,
            type: t.type
        }));

        const llmResults = await categorizeTransactionsBatch(llmPayload);

        // Merge LLM results back into processedTransactions
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

    // Clean up temporary internal fields
    const finalTransactions = processedTransactions.map(({ _originalIndex, ...rest }) => rest);

    // Save to database
    const inserted = await Transaction.insertMany(finalTransactions);

    return res.status(201).json(
        new ApiResponse(201, inserted, `${inserted.length} transactions processed and saved`)
    );
});

export { processBatch };
