import { Transaction } from '../models/transaction.model.js';
import { OverrideRule } from '../models/overrideRule.model.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';
import { categorizeTransactionsBatch } from '../utils/llm.service.js';
import { applyDeterministicRules } from '../utils/rulesEngine.js';

const processBatch = asyncHandler(async (req, res) => {
    const { clientId } = req.params;
    const { transactions } = req.body;

    if (!clientId) {
        throw new ApiError(400, "Client ID is required");
    }

    if (!transactions || !Array.isArray(transactions) || transactions.length === 0) {
        throw new ApiError(400, "An array of transactions is required in the body");
    }

    // Load CA's past overrides for this client
    const overrides = await OverrideRule.find({ clientId });

    const processedTransactions = [];
    const unclassifiedBatch = [];

    // Step 1: Run deterministic rules & overrides
    transactions.forEach(txn => {
        let itrHead = null;
        let taxTreatment = null;
        let relevantSection = null;
        let reasoning = null;
        let engine = 'LLM';
        
        const descLower = (txn.description || "").toLowerCase();
        
        // Check Overrides first (highest priority)
        const matchedOverride = overrides.find(o => o.description.toLowerCase() === descLower);
        if (matchedOverride) {
            itrHead = matchedOverride.newHead;
            taxTreatment = matchedOverride.newTaxTreatment;
            relevantSection = matchedOverride.newSection;
            reasoning = `Matched your past correction -> ${matchedOverride.newHead} (${matchedOverride.newSection || 'N/A'})`;
            engine = 'Rules Engine';
        } else {
            // Check deterministic rules
            const ruleResult = applyDeterministicRules(txn.description, txn.amount, txn.type);
            if (ruleResult) {
                itrHead = ruleResult.itrHead;
                taxTreatment = ruleResult.taxTreatment;
                relevantSection = ruleResult.relevantSection;
                reasoning = ruleResult.reasoning;
                engine = 'Rules Engine';
            }
        }

        const rawType = (txn.type || "Debit").trim();
        const normalizedType = rawType.charAt(0).toUpperCase() + rawType.slice(1).toLowerCase();

        const processedTxn = {
            clientId,
            date: txn.date ? new Date(txn.date) : new Date(), 
            description: txn.description || "Unknown",
            amount: Number(txn.amount) || 0,
            transactionDirection: normalizedType,
            type: normalizedType, // Legacy type preservation if needed by frontend
            itrHead,
            taxTreatment,
            relevantSection,
            reasoning,
            engine,
            status: 'Pending',
            _originalIndex: processedTransactions.length
        };

        processedTransactions.push(processedTxn);

        if (!itrHead || itrHead === "Uncertain - Needs Manual Review" && engine === 'LLM') {
            unclassifiedBatch.push({
                index: processedTxn._originalIndex,
                description: processedTxn.description,
                amount: processedTxn.amount,
                type: processedTxn.transactionDirection
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
            itrHead: o.newHead,
            taxTreatment: o.newTaxTreatment,
            relevantSection: o.newSection
        }));

        try {
            const llmResults = await categorizeTransactionsBatch(llmPayload, pastOverridesContext);

            if (llmResults && llmResults.length === unclassifiedBatch.length) {
                unclassifiedBatch.forEach((unclassified, i) => {
                    const llmCategory = llmResults[i];
                    const targetTxn = processedTransactions[unclassified.index];
                    
                    targetTxn.itrHead = llmCategory.itrHead || "Uncertain - Needs Manual Review";
                    targetTxn.taxTreatment = llmCategory.taxTreatment || "Uncertain";
                    targetTxn.relevantSection = llmCategory.relevantSection || "N/A";
                    targetTxn.reasoning = llmCategory.reasoning || 'No reasoning provided';
                    targetTxn.engine = 'LLM';
                });
            }
        } catch (error) {
            console.error("LLM batch failed, marking as uncertain", error);
            unclassifiedBatch.forEach((unclassified) => {
                const targetTxn = processedTransactions[unclassified.index];
                targetTxn.itrHead = "Uncertain - Needs Manual Review";
                targetTxn.taxTreatment = "Uncertain";
                targetTxn.relevantSection = "N/A";
                targetTxn.reasoning = "LLM API Failed. Manual review required.";
                targetTxn.engine = 'LLM';
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
    const { clientId, description, newHead, newTaxTreatment, newSection } = req.body;

    if (!clientId || !description || !newHead) {
        throw new ApiError(400, "clientId, description, and newHead are required");
    }

    // Upsert the override rule
    const rule = await OverrideRule.findOneAndUpdate(
        { clientId, description: description.trim() },
        { newHead, newTaxTreatment, newSection },
        { upsert: true, new: true }
    );

    return res.status(200).json(new ApiResponse(200, rule, "Override rule saved for future learning"));
});

export { processBatch, saveOverride };
