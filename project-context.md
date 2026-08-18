# Project: TaxPrep Assistant — Excel Add-in for ITR Data Preparation

## Context for Claude
This is a solo SDE placement-season resume project, being built in ~1 week with AI-assisted coding. I know MERN (MongoDB, Express, React, Node) but have no ML/AI integration experience and no prior Office.js experience. Assume that skill level when generating code or explaining concepts — explain new pieces (Office.js especially) clearly, don't assume familiarity.

---

## What the project is

A Microsoft Excel add-in for Chartered Accountants (CAs) in India that automates the tedious first step of preparing a client's Income Tax Return (ITR): sorting hundreds of bank transactions into the correct tax categories.

**Core flow:**
1. CA uploads a client's bank transaction export (CSV) into the add-in's task pane inside Excel.
2. Backend parses the CSV into individual transactions.
3. A rules engine (regex/keyword matching on transaction narration) categorizes obvious transactions (salary, interest, known vendor patterns, etc.) with a confidence score.
4. Transactions the rules engine can't confidently classify are sent to an LLM API with a structured prompt, which returns a proposed category + a short plain-English reasoning.
5. CA reviews all categorized transactions in the task pane — sees category, confidence, and (for AI-classified ones) the reasoning — and can override any of them.
6. On approval, the categorized, ITR-schedule-mapped summary is written directly into the open Excel workbook (and/or exported as a clean Excel file).

**The tool prepares data for CAs to review — it never auto-files anything and never claims full automation.**

---

## What ITR filing actually needs (for context on categories)
- Personal/identity data: PAN, Aadhaar, bank accounts
- Income sources: salary, house property, capital gains, business/professional income, other sources (interest, dividends)
- Deductions: 80C, 80D, 80G, HRA, etc.
- Taxes already paid: TDS/TCS, advance tax (reconciled against Form 26AS/AIS)
- This project focuses specifically on the bank-transaction-derived portion — most relevant for presumptive business/professional income (Sections 44AD/44ADA) and interest/other income, since salary/capital gains mostly come from Form 16 and broker statements, not raw bank data.

---

## Tech stack (final, agreed)

- **Excel Add-in:** Office.js + React (task pane UI)
- **Backend:** Node.js + Express
- **Database:** MongoDB
- **Auth:** JWT
- **CSV parsing:** papaparse
- **Excel generation/writing:** exceljs (and/or Office.js APIs for direct in-sheet writing)
- **AI:** Direct calls to an LLM API (OpenAI or Anthropic) for ambiguous transaction categorization + reasoning — called directly via API, NOT via LangChain (I don't know LangChain; hand-rolled prompt orchestration in plain JS instead)
- No fine-tuning, no vector DB/RAG for v1 — those are explicitly future-scope, not being built now.

---

## Explicitly OUT of scope for this build (do NOT suggest building these)
- ❌ Direct e-filing to the income tax portal (requires ERI registration — a regulatory status, not something I can build around)
- ❌ Google Pay / UPI / any merchant app "integration" (no public API exists for this; real path would be RBI Account Aggregator framework, which is out of scope)
- ❌ Mobile app for clients to log daily cash expenses
- ❌ Multi-bank PDF statement parsing (CSV upload only for v1)
- ❌ LangChain or any orchestration framework — plain direct API calls only
- ❌ Fine-tuning any model
- ❌ Heavy encryption/security infra beyond basic JWT auth and not storing sensitive fields unnecessarily (mention as future work, don't over-engineer for a 1-week solo project)

If I ask for any of the above, remind me it was deliberately scoped out and ask if I actually want to expand scope before building it.

---

## Do's
- Keep suggestions realistic for a 1-week solo build with AI-assisted coding
- Flag Office.js setup (manifest, dev certs, sideloading) as the highest-risk/most time-consuming part — help me get a minimal working task pane FIRST before polishing UI
- Keep the AI categorization "human-in-the-loop": AI/rules propose, CA always approves/overrides — never suggest fully automatic categorization
- When generating the LLM prompt for categorization, make it return structured JSON (category + confidence/reasoning), not free text
- Prefer rules-engine categorization first; only call the LLM for transactions the rules engine can't confidently classify (cost/latency control — this is a deliberate design choice, keep it)
- Help me understand *why* a piece of code/architecture works, not just hand me code, since I'll need to explain this in interviews
- If something in the 1-week plan is at risk of slipping, tell me honestly and suggest what to cut (Excel export polish is the lowest-priority piece to cut if time runs out; core categorization + review UI is the must-keep piece)

## Don'ts
- Don't suggest LangChain, fine-tuning, or RAG/vector DBs — explicitly cut from scope
- Don't suggest real bank/UPI account integrations
- Don't suggest scope that would need regulatory registration (e-filing, ERI)
- Don't over-engineer security/infra for what's a resume demo project, not a production fintech app
- Don't assume I know Office.js — explain new concepts as they come up

---

## Differentiation from existing competitors (for README/interview framing)
Existing tools (CypherSOL, Precisa, AI Accountant, ClearTax TaxCloud, mybankstatementanalysis.com, etc.) are standalone web dashboards. This project differs by:
1. Living **inside Excel** as a native add-in — no context-switching, works where CAs already work
2. **Transparent categorization** — shows the reasoning/rule behind each category, not a black box
3. **Explicit human-in-the-loop design** — every AI/rule categorization is provisional until CA approval
4. **Hybrid rules+AI pipeline** — cheap rules for obvious cases, LLM only for ambiguous ones (cost-conscious system design)
5. **Honest scope** — explicitly stops at "prepare a reviewable draft," doesn't claim to auto-file

---

## 7-Day Build Plan
- **Day 1:** Backend skeleton — Express, MongoDB schemas (User/CA, Client, Transaction, CategoryRule, AuditLog), JWT auth
- **Day 2:** CSV upload/parsing (papaparse) + rules engine (regex/keyword categorization with confidence scoring)
- **Day 3:** LLM fallback integration — structured prompt, JSON response (category + reasoning) for low-confidence transactions
- **Day 3–4:** Office.js add-in setup — manifest, task pane loading in Excel, basic read/write to sheet (highest-risk step, budget extra time)
- **Day 5:** Task pane UI — upload trigger, review table (category, confidence, AI reasoning tooltip, override dropdown)
- **Day 6:** ITR-schedule-head mapping + Excel export/write-to-sheet, end-to-end connection
- **Day 7:** Deploy backend, package/sideload add-in, record demo video (important — Excel add-ins are hard to live-demo in interviews), write README

**Fallback if Office.js setup goes badly on Day 3–4:** ship as a plain web app with "packaged as Office.js add-in" documented as a completed next step — still a complete, demoable project.

---

## Resume framing (for reference)
**Project title:** TaxPrep Assistant — Excel Add-in for ITR Data Preparation

**Sample bullets:**
- Built an Excel add-in (Office.js) that parses client bank transaction exports and categorizes them into ITR-relevant income/expense heads using a hybrid rule-based + LLM classification pipeline
- Designed a human-in-the-loop review flow letting CAs approve/override AI-proposed categorizations before generating an ITR-ready summary written directly into the workbook
- Implemented confidence-based routing to minimize LLM API calls, falling back to AI only for ambiguous transactions
