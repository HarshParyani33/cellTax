import 'dotenv/config';
import fs from 'fs';
import { applyDeterministicRules } from './src/utils/rulesEngine.js';
import { categorizeTransactionsBatch } from './src/utils/llm.service.js';

const testTransactions = [
    { date: "2026-09-01", description: "TechCorp Salary Sept", amount: 150000, type: "Credit" },
    { date: "2026-09-02", description: "Savings Bank Interest", amount: 2300, type: "Credit" },
    { date: "2026-09-03", description: "HDFC FD Interest", amount: 15000, type: "Credit" },
    { date: "2026-09-04", description: "LIC Premium Payment", amount: 12000, type: "Debit" },
    { date: "2026-09-05", description: "Star Health Mediclaim", amount: 18000, type: "Debit" },
    { date: "2026-09-06", description: "Zerodha Fund Transfer", amount: 50000, type: "Debit" },
    { date: "2026-09-07", description: "Swiggy Food Order", amount: 450, type: "Debit" },
    { date: "2026-09-08", description: "UPI Transfer to Rahul", amount: 5000, type: "Debit" },
    { date: "2026-09-09", description: "Consulting Fee received", amount: 85000, type: "Credit" },
    { date: "2026-09-10", description: "Amazon AWS Hosting", amount: 1200, type: "Debit" },
    { date: "2026-09-11", description: "Office Supplies Stationery", amount: 1500, type: "Debit" },
    { date: "2026-09-12", description: "Rent Payment - Landlord", amount: 25000, type: "Debit" },
    { date: "2026-09-13", description: "Unknown NEFT Transfer", amount: 12000, type: "Credit" },
    { date: "2026-09-14", description: "Income Tax Refund", amount: 4500, type: "Credit" },
    { date: "2026-09-15", description: "Client Payment invoice #1029", amount: 45000, type: "Credit" }
];

async function runTestHarness() {
    console.log("Starting Test Harness Pipeline...\n");

    const processed = [];
    const unclassified = [];

    // Step 1: Deterministic Rules Engine
    testTransactions.forEach((txn, index) => {
        const ruleResult = applyDeterministicRules(txn.description, txn.amount, txn.type);
        
        if (ruleResult) {
            processed.push({
                index,
                description: txn.description,
                engine: "Rules Engine",
                ...ruleResult
            });
        } else {
            unclassified.push({
                index,
                description: txn.description,
                amount: txn.amount,
                type: txn.type
            });
        }
    });

    // Step 2: LLM Fallback
    if (unclassified.length > 0) {
        console.log(`Sending ${unclassified.length} transactions to LLM...\n`);
        const llmPayload = unclassified.map(t => ({
            description: t.description,
            amount: t.amount,
            type: t.type
        }));

        try {
            const llmResults = await categorizeTransactionsBatch(llmPayload, []);
            
            unclassified.forEach((txn, i) => {
                const result = llmResults[i];
                processed.push({
                    index: txn.index,
                    description: txn.description,
                    engine: "LLM",
                    itrHead: result.itrHead,
                    taxTreatment: result.taxTreatment,
                    relevantSection: result.relevantSection,
                    reasoning: result.reasoning
                });
            });
        } catch (error) {
            console.error("LLM Pipeline Failed:", error);
        }
    }

    // Sort back to original order
    processed.sort((a, b) => a.index - b.index);

    // Generate Markdown Table
    let mdTable = "| Description | ITR Head | Tax Treatment | Section | Engine | Reasoning |\n";
    mdTable += "|-------------|----------|---------------|---------|--------|-----------|\n";
    
    processed.forEach(p => {
        mdTable += `| ${p.description} | ${p.itrHead} | ${p.taxTreatment} | ${p.relevantSection} | **${p.engine}** | ${p.reasoning} |\n`;
    });

    fs.writeFileSync("test_harness_output.md", mdTable);
    console.log("Test complete. Results written to test_harness_output.md");
}

runTestHarness();
