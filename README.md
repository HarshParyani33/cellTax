# TaxPrep Assistant — Excel Add-in for ITR Data Preparation

An intelligent Microsoft Excel add-in built for Chartered Accountants (CAs) in India to automate the tedious first step of preparing a client's Income Tax Return (ITR): sorting hundreds of bank transactions into the correct tax categories.

## Overview

Existing tools are often standalone web dashboards that require context-switching and act as black boxes. This project is different:
1. **Native Excel Integration:** Lives inside Excel as a native add-in — works where CAs already work.
2. **Transparent Categorization:** Shows the reasoning/rule behind each AI category so you can trust the results.
3. **Human-in-the-Loop:** Every categorization is provisional until explicitly approved or overridden by the CA.
4. **Cost-Conscious Pipeline:** Uses a hybrid rules+AI engine. Cheap, deterministic rules handle obvious cases (e.g. salary, Zomato, interest), while an LLM is only called for ambiguous, low-confidence transactions.
5. **No Auto-filing:** Explicitly designed to prepare a reviewable draft, not to auto-file returns.

## Tech Stack

- **Frontend / Add-in:** React (JavaScript/JSX) + Office.js
- **Backend:** Node.js + Express
- **Database:** MongoDB (Mongoose)
- **Authentication:** JWT
- **Data Parsing:** PapaParse (for CSV processing)

## How It Works

1. **Upload:** CA uploads a client's bank transaction export (CSV) via the add-in's task pane inside Excel.
2. **Parse & Match:** The backend parses the transactions and runs them through a regex/keyword rules engine.
3. **AI Fallback:** Transactions that the rules engine cannot confidently classify are sent directly to an LLM API. The LLM returns a proposed ITR category along with a short plain-English explanation.
4. **Review:** The CA reviews all categorized transactions, including the AI's reasoning, and approves or overrides them directly from the task pane.
5. **Write to Sheet:** Upon approval, a finalized ITR-schedule-mapped summary is written directly into the active Excel workbook.

## Setup & Local Development

### Prerequisites
- Node.js & npm
- MongoDB instance (local or Atlas)
- Microsoft Excel (Desktop or Web)

### Backend Setup
```bash
cd backend
npm install
npm run dev
```

### Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

### Running the Add-in
1. Start both the backend and frontend dev servers.
2. Sideload `frontend/manifest.xml` into Excel to launch the task pane.
