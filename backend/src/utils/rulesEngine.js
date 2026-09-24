/**
 * Deterministic Rules Engine for Indian Income Tax
 * Resolves standard transactions to exact ITR Heads and Sections.
 */
export const applyDeterministicRules = (description, amount, type) => {
    const descLower = description.toLowerCase();

    // 1. Savings Bank Interest -> IFOS (80TTA/80TTB)
    if ((descLower.includes("interest") || descLower.includes("int pd")) && descLower.includes("saving")) {
        return {
            itrHead: "IFOS",
            taxTreatment: "Taxable",
            relevantSection: "Sec 80TTA", // (Assuming < 60 years old for this demo)
            reasoning: "Rules Engine: Savings account interest is taxable under Other Sources, eligible for 80TTA deduction.",
            confidence: 1.0
        };
    }

    // 2. Fixed Deposit Interest -> IFOS (No 80TTA)
    if (descLower.includes("interest") && (descLower.includes("fd") || descLower.includes("fixed deposit"))) {
        return {
            itrHead: "IFOS",
            taxTreatment: "Taxable",
            relevantSection: "N/A",
            reasoning: "Rules Engine: FD interest is fully taxable under IFOS.",
            confidence: 1.0
        };
    }

    // 3. LIC Premium / Life Insurance -> Chapter VI-A (80C)
    if ((descLower.includes("lic") || descLower.includes("life insurance")) && type.toLowerCase() === "debit") {
        return {
            itrHead: "Chapter VI-A Deduction",
            taxTreatment: "Deductible",
            relevantSection: "Sec 80C",
            reasoning: "Rules Engine: Life insurance premiums are deductible under Section 80C.",
            confidence: 1.0
        };
    }

    // 4. Medical Insurance (Mediclaim) -> Chapter VI-A (80D)
    if (descLower.includes("mediclaim") || (descLower.includes("health") && descLower.includes("insurance"))) {
        return {
            itrHead: "Chapter VI-A Deduction",
            taxTreatment: "Deductible",
            relevantSection: "Sec 80D",
            reasoning: "Rules Engine: Health insurance premiums are deductible under Section 80D.",
            confidence: 1.0
        };
    }

    // 5. Standard Salary Credit -> Salary Income
    if ((descLower.includes("salary") || descLower.includes("payroll")) && type.toLowerCase() === "credit") {
        return {
            itrHead: "Salary",
            taxTreatment: "Taxable",
            relevantSection: "Sec 17(1)",
            reasoning: "Rules Engine: Standard salary credit.",
            confidence: 0.95
        };
    }

    // 6. Mutual Fund / Equity Investments -> Asset Purchase (No immediate deduction, Capital Gains on sale)
    if (descLower.includes("zerodha") || descLower.includes("groww") || descLower.includes("mutual fund")) {
        return {
            itrHead: "Not Applicable (Personal/Transfer)",
            taxTreatment: "Non-Deductible", // Unless ELSS, but we can't be sure
            relevantSection: "N/A",
            reasoning: "Rules Engine: Capital asset purchase. Not deductible unless specifically ELSS.",
            confidence: 0.9
        };
    }

    // 7. Income Tax Refund -> Uncertain (Requires manual split of principal and interest)
    if (descLower.includes("tax refund") || descLower.includes("it refund") || descLower.includes("income tax")) {
        return {
            itrHead: "Uncertain - Needs Manual Review",
            taxTreatment: "Uncertain",
            relevantSection: "N/A",
            reasoning: "Rules Engine: Income tax refund requires prior-year data to split principal (Exempt) from interest (Taxable).",
            confidence: 1.0
        };
    }

    return null; // No deterministic rule matched -> route to LLM
};
