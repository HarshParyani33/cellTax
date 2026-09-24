import OpenAI from 'openai';

// Initialize the OpenAI client pointing to Groq
const openai = new OpenAI({
    baseURL: "https://api.groq.com/openai/v1",
    apiKey: process.env.GROQ_API_KEY,
});

// We use the specified model on Groq
const MODEL_NAME = process.env.GROQ_MODEL || 'openai/gpt-oss-120b';

/**
 * Categorize a batch of transactions using the LLM via OpenRouter.
 * Automatically chunks the requests to avoid token limits and parse failures.
 * @param {Array} transactions Array of unclassified transaction objects
 * @param {Array} pastOverrides Array of past manual overrides from the CA
 * @returns {Promise<Array>} Array of categorized transactions (category, confidence, reasoning)
 */
const categorizeTransactionsBatch = async (transactions, pastOverrides = []) => {
    if (!transactions || transactions.length === 0) return [];

    const overrideContext = pastOverrides.length > 0 
        ? `\nHere are some past categorization corrections made by the CA for this specific client. Learn from these examples:\n${JSON.stringify(pastOverrides, null, 2)}\n` 
        : "";

    const CHUNK_SIZE = 10;
    let allCategorizedResults = [];

    // Process in chunks
    for (let i = 0; i < transactions.length; i += CHUNK_SIZE) {
        const chunk = transactions.slice(i, i + CHUNK_SIZE);
        console.log(`Processing LLM chunk ${i / CHUNK_SIZE + 1} of ${Math.ceil(transactions.length / CHUNK_SIZE)} (${chunk.length} transactions)...`);

        const prompt = `
You are an expert Indian Chartered Accountant (CA). Your task is to classify bank transactions for an individual/sole proprietor for ITR filing purposes.
${overrideContext}
Here are the transactions:
${JSON.stringify(chunk, null, 2)}

For each transaction, you must output exactly four fields:
1. "itrHead": Must be one of ["Salary", "House Property", "PGBP", "Capital Gains", "IFOS", "Chapter VI-A Deduction", "Not Applicable (Personal/Transfer)", "Uncertain - Needs Manual Review"]. 
2. "taxTreatment": Must be one of ["Taxable", "Exempt", "Deductible", "Non-Deductible", "Contra"].
3. "relevantSection": You MUST ONLY pick from this exact list: ["Sec 80C", "Sec 80D", "Sec 80TTA", "Sec 44ADA", "Sec 37(1)", "N/A"]. Do not generate any other section numbers. If none apply, output "N/A".
4. "reasoning": A plain-English professional tax justification.

CRITICAL INSTRUCTIONS:
1. Debit vs Credit logic:
   - Debit (money leaving): CANNOT be "Taxable". It is either a business expense ("Deductible"), or a personal expense/transfer/investment ("Non-Deductible" or "Contra").
   - Credit (money entering): CANNOT be "Deductible". It is usually income ("Taxable" or "Exempt") or a personal transfer/cash deposit ("Non-Deductible" or "Contra").
2. Definition of ITR Heads:
   - "PGBP": Use for ALL business/freelance income (consulting, invoices) AND business expenses (hosting, stationery, office rent). DO NOT use "Not Applicable" for business transactions.
   - "IFOS": Use for Savings/FD interest, Dividends, and LIC Maturity.
   - "Not Applicable (Personal/Transfer)": Use ONLY for personal living expenses (food, movies), personal transfers, or moving cash between own accounts (ATM withdrawals/cash deposits).
3. "Contra" entries: Cash withdrawn from ATM or deposited to self is "Contra" (or "Non-Deductible") and "Not Applicable". It is NEVER a deductible expense.
4. "Uncertain": If completely ambiguous, use "Uncertain - Needs Manual Review" and "Uncertain".

FEW-SHOT EXAMPLES:
Input: {"description": "Zomato Food Order", "amount": 450, "type": "Debit"}
Output: {"itrHead": "Not Applicable (Personal/Transfer)", "taxTreatment": "Non-Deductible", "relevantSection": "N/A", "reasoning": "Debit for personal food delivery is a non-deductible personal expense."}

Input: {"description": "Consulting Fee / Invoice #1029", "amount": 85000, "type": "Credit"}
Output: {"itrHead": "PGBP", "taxTreatment": "Taxable", "relevantSection": "N/A", "reasoning": "Credit for professional consulting fee is taxable business income."}

Input: {"description": "AWS Hosting Services", "amount": 1200, "type": "Debit"}
Output: {"itrHead": "PGBP", "taxTreatment": "Deductible", "relevantSection": "Sec 37(1)", "reasoning": "Debit for cloud hosting is a deductible general business expense under Section 37(1)."}

Input: {"description": "ATM Cash Withdrawal", "amount": 5000, "type": "Debit"}
Output: {"itrHead": "Not Applicable (Personal/Transfer)", "taxTreatment": "Contra", "relevantSection": "N/A", "reasoning": "Cash withdrawal is a contra entry, not a deductible expense."}

Input: {"description": "Dividend from Reliance", "amount": 1500, "type": "Credit"}
Output: {"itrHead": "IFOS", "taxTreatment": "Taxable", "relevantSection": "N/A", "reasoning": "Dividend income is taxable under Other Sources."}

Respond STRICTLY with a valid JSON array of objects. Do not include markdown code blocks (like \`\`\`json) or any introductory/explanatory text. Just the raw array starting with '[' and ending with ']'. The array must be in the exact same order as the input transactions. Each object should have this exact structure:
[
  {
    "itrHead": "string",
    "taxTreatment": "string",
    "relevantSection": "string",
    "reasoning": "string"
  }
]
`;

        let chunkSuccess = false;
        const MAX_RETRIES = 1;

        for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
            if (attempt > 0) {
                console.log(`Retrying chunk ${i / CHUNK_SIZE + 1} (Attempt ${attempt + 1})...`);
            }
            try {
                const maxTokens = 2000;
                const completion = await openai.chat.completions.create({
                    model: MODEL_NAME,
                    temperature: 0,
                    max_tokens: maxTokens,
                    messages: [
                        { role: "system", content: "You are a precise assistant that outputs ONLY raw JSON arrays. No prose, no markdown formatting." },
                        { role: "user", content: prompt }
                    ]
                });

                const content = completion.choices[0].message.content;
                
                let parsedResponse = [];
                try {
                    // STRIP AND VALIDATE: Find the first '[' and the last ']' to ignore any prose/markdown
                    const firstBracket = content.indexOf('[');
                    const lastBracket = content.lastIndexOf(']');
                    
                    if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
                        const jsonSubstring = content.substring(firstBracket, lastBracket + 1);
                        parsedResponse = JSON.parse(jsonSubstring);
                    } else {
                        // Fallback to strict JSON parse if brackets not clearly identified
                        const cleanContent = content.replace(/```json/g, '').replace(/```/g, '').trim();
                        parsedResponse = JSON.parse(cleanContent);
                    }
                    
                    // If it returned { "transactions": [...] } instead of an array directly
                    if (!Array.isArray(parsedResponse) && parsedResponse.transactions) {
                        parsedResponse = parsedResponse.transactions;
                    } else if (!Array.isArray(parsedResponse) && Object.keys(parsedResponse).length === 1) {
                        parsedResponse = Object.values(parsedResponse)[0];
                    }
                    
                    if (!Array.isArray(parsedResponse)) {
                        throw new Error("Parsed response is not an array");
                    }

                    // Verify the array length matches the chunk
                    if (parsedResponse.length !== chunk.length) {
                        console.warn(`Warning: LLM returned ${parsedResponse.length} items for a chunk of ${chunk.length} items. Missing items will be marked as uncertain.`);
                        
                        // Pad with uncertain if needed
                        while (parsedResponse.length < chunk.length) {
                            parsedResponse.push({
                                itrHead: "Uncertain - Needs Manual Review",
                                taxTreatment: "Uncertain",
                                relevantSection: "N/A",
                                reasoning: "LLM missed this transaction in the output array."
                            });
                        }
                        // Truncate if too many
                        if (parsedResponse.length > chunk.length) {
                            parsedResponse = parsedResponse.slice(0, chunk.length);
                        }
                    }

                    allCategorizedResults.push(...parsedResponse);
                    chunkSuccess = true;
                    if (attempt === 0) {
                        console.log(`Chunk ${i / CHUNK_SIZE + 1} succeeded on first try.`);
                    } else {
                        console.log(`Chunk ${i / CHUNK_SIZE + 1} succeeded after retry.`);
                    }
                    break; // Success, break out of retry loop

                } catch (parseError) {
                    console.error(`Failed to parse LLM response for chunk ${i / CHUNK_SIZE + 1} (Attempt ${attempt + 1}). Output length: ${content.length} characters (max_tokens was set to ${maxTokens}).`);
                    console.error("Content was:", content);
                    console.error(parseError);
                    if (attempt === MAX_RETRIES) {
                        // FAIL PER-BATCH: Mark only this chunk as uncertain, don't crash the whole run
                        const fallbackChunk = chunk.map(() => ({
                            itrHead: "Uncertain - Needs Manual Review",
                            taxTreatment: "Uncertain",
                            relevantSection: "N/A",
                            reasoning: "LLM API parse failed for this batch after retry."
                        }));
                        allCategorizedResults.push(...fallbackChunk);
                    }
                }

            } catch (apiError) {
                console.error(`LLM API Call Error for chunk ${i / CHUNK_SIZE + 1} (Attempt ${attempt + 1}):`, apiError);
                if (attempt === MAX_RETRIES) {
                    // FAIL PER-BATCH: Mark only this chunk as uncertain
                    const fallbackChunk = chunk.map(() => ({
                        itrHead: "Uncertain - Needs Manual Review",
                        taxTreatment: "Uncertain",
                        relevantSection: "N/A",
                        reasoning: "LLM API call failed (e.g. timeout or connection error) for this batch after retry."
                    }));
                    allCategorizedResults.push(...fallbackChunk);
                }
            }
        }
    }

    return allCategorizedResults;
};

export { categorizeTransactionsBatch };
