import OpenAI from 'openai';

// Initialize the OpenAI client pointing to OpenRouter
const openai = new OpenAI({
    baseURL: "https://openrouter.ai/api/v1",
    apiKey: process.env.OPENROUTER_API_KEY,
});

// We default to the gemma model requested, but allow override via env
const MODEL_NAME = process.env.OPENROUTER_MODEL || 'google/gemma-2-9b-it';

/**
 * Categorize a batch of transactions using the LLM via OpenRouter.
 * @param {Array} transactions Array of unclassified transaction objects
 * @returns {Promise<Array>} Array of categorized transactions (category, confidence, reasoning)
 */
const categorizeTransactionsBatch = async (transactions) => {
    if (!transactions || transactions.length === 0) return [];

    const prompt = `
You are an expert Indian Chartered Accountant (CA) assistant. Your task is to categorize a batch of bank transactions into ITR-relevant income/expense heads. 

Here are the transactions:
${JSON.stringify(transactions, null, 2)}

For each transaction, determine the best category from the following standard list:
- Salary
- Interest
- Business Income
- Office Expense
- Personal
- Uncategorized (if truly unknown)

Also provide a confidence score between 0.0 and 1.0, and a brief reasoning for your choice.

Respond strictly in JSON format as an array of objects, with no markdown formatting or extra text. The array must be in the exact same order as the input transactions. Each object should have this structure:
{
  "category": "string",
  "confidence": number,
  "reasoning": "string"
}
`;

    try {
        const completion = await openai.chat.completions.create({
            model: MODEL_NAME,
            messages: [
                { role: "system", content: "You are a helpful and precise assistant that outputs strictly valid JSON arrays." },
                { role: "user", content: prompt }
            ],
            // Since Gemma might not support strict structured outputs through OpenRouter out of the box,
            // we instruct it via prompt. However, we can ask for json response format if supported:
            response_format: { type: "json_object" } 
        });

        const content = completion.choices[0].message.content;
        
        let parsedResponse;
        try {
            // Strip any potential markdown block backticks just in case
            const cleanContent = content.replace(/```json/g, '').replace(/```/g, '').trim();
            parsedResponse = JSON.parse(cleanContent);
            
            // If the LLM returned a JSON object wrapping the array like { "transactions": [...] }
            if (!Array.isArray(parsedResponse) && parsedResponse.transactions) {
                parsedResponse = parsedResponse.transactions;
            } else if (!Array.isArray(parsedResponse) && Object.keys(parsedResponse).length === 1) {
                // Another common pattern: { "result": [...] }
                parsedResponse = Object.values(parsedResponse)[0];
            }
            
            if (!Array.isArray(parsedResponse)) {
                throw new Error("Parsed response is not an array");
            }
        } catch (parseError) {
            console.error("Failed to parse LLM response:", content);
            throw parseError;
        }

        return parsedResponse;
    } catch (error) {
        console.error("LLM Service Error:", error);
        // Fallback for all transactions in this batch on error
        return transactions.map(() => ({
            category: "Uncategorized",
            confidence: 0,
            reasoning: "LLM API failed or timed out"
        }));
    }
};

export { categorizeTransactionsBatch };
