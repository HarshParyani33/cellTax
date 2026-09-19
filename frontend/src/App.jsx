import { useState } from 'react';
import Papa from 'papaparse';
import axios from 'axios';
import { Analytics } from './components/Analytics';
import { exportToExcel } from './utils/excelHelper';
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
          const mappedTransactions = results.data.map((row) => ({
            date: row.Date || row.date || new Date().toISOString(),
            description: row.Description || row.Narration || row.description || row.narration || "Unknown",
            amount: parseFloat(row.Amount || row.amount || row.Withdrawal || row.Deposit || 0),
            type: (row.Type || row.type || "Debit").trim(),
          }));

          const clientId = "507f1f77bcf86cd799439011"; 
          
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

  const handleCategoryChange = async (index, newCategory) => {
    const txn = transactions[index];
    const originalCategory = txn.proposedCategory;
    
    // Update UI immediately
    const updated = [...transactions];
    updated[index].proposedCategory = newCategory;
    setTransactions(updated);

    // Call override API for feedback loop
    try {
      await axios.post('http://localhost:5000/api/v1/transactions/override', {
        clientId: "507f1f77bcf86cd799439011",
        description: txn.description,
        originalCategory,
        newCategory
      });
    } catch (err) {
      console.error("Failed to save override rule", err);
    }
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
            <Analytics transactions={transactions} />
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2>Categorized Transactions</h2>
              <button onClick={() => exportToExcel(transactions)} className="upload-btn" style={{ background: '#10B981' }}>
                Export to Workbook
              </button>
            </div>
            
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
                      <td className={txn.type.toLowerCase() === 'debit' || txn.type.toLowerCase() === 'expense' ? 'amt-debit' : 'amt-credit'}>
                        {txn.amount}
                      </td>
                      <td className={txn.type.toLowerCase() === 'debit' || txn.type.toLowerCase() === 'expense' ? 'type-debit' : 'type-credit'}>
                        {txn.type}
                      </td>
                      <td>
                        <select 
                          value={txn.proposedCategory || "Uncategorized"}
                          onChange={(e) => handleCategoryChange(index, e.target.value)}
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
                      <td>{txn.confidenceScore ? (txn.confidenceScore > 1 ? txn.confidenceScore : txn.confidenceScore * 100).toFixed(0) + '%' : 'N/A'}</td>
                      <td className="reasoning-cell">
                        {txn.aiReasoning}
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
