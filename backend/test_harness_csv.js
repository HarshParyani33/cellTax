import 'dotenv/config';
import fs from 'fs';
import { parse } from 'csv-parse/sync';
import { applyDeterministicRules } from './src/utils/rulesEngine.js';
import { categorizeTransactionsBatch } from './src/utils/llm.service.js';

async function runCSVHarness() {
    console.log("Starting CSV Test Harness Pipeline...\n");

    const fileContent = fs.readFileSync('../test_transactions.csv', 'utf8');
    const records = parse(fileContent, {
        columns: true,
        skip_empty_lines: true
    });

    const processedTransactions = [];
    const unclassifiedBatch = [];

    records.forEach((row, index) => {
        const rawType = (row.type || "Debit").trim();
        const normalizedType = rawType.charAt(0).toUpperCase() + rawType.slice(1).toLowerCase();
        const amount = parseFloat(row.amount || row.Withdrawal || row.Deposit || 0);
        const description = row.narration || row.Description || row.description || "Unknown";

        const txn = {
            _originalIndex: index,
            description,
            amount,
            type: normalizedType
        };

        const ruleResult = applyDeterministicRules(txn.description, txn.amount, txn.type);
        if (ruleResult) {
            txn.itrHead = ruleResult.itrHead;
            txn.taxTreatment = ruleResult.taxTreatment;
            txn.relevantSection = ruleResult.relevantSection;
            txn.reasoning = ruleResult.reasoning;
            txn.engine = 'Rules Engine';
        } else {
            unclassifiedBatch.push(txn);
        }
        processedTransactions.push(txn);
    });

    if (unclassifiedBatch.length > 0) {
        console.log(`Sending ${unclassifiedBatch.length} transactions to LLM...\n`);
        const llmPayload = unclassifiedBatch.map(t => ({
            description: t.description,
            amount: t.amount,
            type: t.type
        }));

        const llmResults = await categorizeTransactionsBatch(llmPayload, []);

        if (llmResults && llmResults.length === unclassifiedBatch.length) {
            unclassifiedBatch.forEach((unclassified, i) => {
                const llmCategory = llmResults[i];
                const targetTxn = processedTransactions[unclassified._originalIndex];
                
                targetTxn.itrHead = llmCategory.itrHead || "Uncertain - Needs Manual Review";
                targetTxn.taxTreatment = llmCategory.taxTreatment || "Uncertain";
                targetTxn.relevantSection = llmCategory.relevantSection || "N/A";
                targetTxn.reasoning = llmCategory.reasoning || 'No reasoning provided';
                targetTxn.engine = 'LLM';
            });
        }
    }

    let markdownTable = "| Description | Type | ITR Head | Tax Treatment | Section | Engine | Reasoning |\n";
    markdownTable += "|-------------|------|----------|---------------|---------|--------|-----------|\n";
    
    processedTransactions.forEach(t => {
        markdownTable += `| ${t.description} | ${t.type} | ${t.itrHead} | ${t.taxTreatment} | ${t.relevantSection} | **${t.engine}** | ${t.reasoning} |\n`;
    });

    fs.writeFileSync('csv_test_output.md', markdownTable);
    console.log("Test complete. Results written to csv_test_output.md");
}

runCSVHarness().catch(console.error);
