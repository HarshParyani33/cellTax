import { useState } from 'react';
import Papa from 'papaparse';
import axios from 'axios';
import './App.css';

function App() {
  const [file, setFile] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
    setError(null);
  };

  const handleUpload = () => {
    if (!file) {
      setError("Please select a file first.");
      return;
    }

    setLoading(true);
    setError(null);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          // Normalize headers to ensure we get date, description, amount, type
          // Realistically, bank CSVs have different headers. For now, we assume standard ones
          // or we map them.
          const mappedTransactions = results.data.map((row) => ({
            date: row.Date || row.date || new Date().toISOString(),
            description: row.Description || row.Narration || row.description || row.narration || "Unknown",
            amount: parseFloat(row.Amount || row.amount || row.Withdrawal || row.Deposit || 0),
            type: (row.Type || row.type || "Debit").trim(),
          }));

          // Send to backend
          // We assume a dummy clientId for now since auth isn't fully connected in frontend
          const clientId = "client_123"; 
          
          const response = await axios.post(`http://localhost:5000/api/v1/transactions/batch/${clientId}`, {
            transactions: mappedTransactions
          });

          if (response.data && response.data.data) {
            setTransactions(response.data.data);
          }
        } catch (err) {
          console.error(err);
          setError("Failed to process transactions. Is the backend running?");
        } finally {
          setLoading(false);
        }
      },
      error: (err) => {
        setError("Error parsing CSV: " + err.message);
        setLoading(false);
      }
    });
  };

  return (
    <div className="container">
      <header className="header">
        <h1>TaxPrep Assistant</h1>
        <p>Upload a client's bank statement (CSV) to auto-categorize transactions.</p>
      </header>

      <main className="main-content">
        <section className="upload-section">
          <input 
            type="file" 
            accept=".csv" 
            onChange={handleFileChange} 
            className="file-input" 
          />
          <button 
            onClick={handleUpload} 
            disabled={!file || loading}
            className="upload-btn"
          >
            {loading ? "Processing..." : "Upload and Categorize"}
          </button>
          {error && <p className="error">{error}</p>}
        </section>

        {transactions.length > 0 && (
          <section className="results-section">
            <h2>Categorized Transactions</h2>
            <div className="table-container">
              <table className="transactions-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Description</th>
                    <th>Amount</th>
                    <th>Proposed Category</th>
                    <th>Confidence</th>
                    <th>Reasoning</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((txn, index) => (
                    <tr key={index} className={txn.confidenceScore < 0.8 ? "low-confidence" : "high-confidence"}>
                      <td>{new Date(txn.date).toLocaleDateString()}</td>
                      <td>{txn.description}</td>
                      <td>{txn.amount}</td>
                      <td>
                        <select 
                          defaultValue={txn.proposedCategory || "Uncategorized"}
                          className="category-select"
                        >
                          <option value="Uncategorized">Uncategorized</option>
                          <option value="Salary">Salary</option>
                          <option value="Interest">Interest</option>
                          <option value="Business Income">Business Income</option>
                          <option value="Office Expense">Office Expense</option>
                          <option value="Personal">Personal</option>
                          {txn.proposedCategory && ![
                            "Uncategorized", "Salary", "Interest", "Business Income", "Office Expense", "Personal"
                          ].includes(txn.proposedCategory) && (
                            <option value={txn.proposedCategory}>{txn.proposedCategory}</option>
                          )}
                        </select>
                      </td>
                      <td>{txn.confidenceScore ? (txn.confidenceScore * 100).toFixed(0) + '%' : 'N/A'}</td>
                      <td>
                        <span className="tooltip-trigger" title={txn.aiReasoning}>
                          ℹ️
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

export default App;
