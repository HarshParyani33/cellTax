import { useState } from 'react';
import Papa from 'papaparse';
import axios from 'axios';
import { Analytics } from './components/Analytics';
import { exportToExcel } from './utils/excelHelper';
import './App.css';

const ITR_HEADS = ["Salary", "House Property", "PGBP", "Capital Gains", "IFOS", "Chapter VI-A Deduction", "Not Applicable (Personal/Transfer)", "Uncertain - Needs Manual Review"];
const TAX_TREATMENTS = ["Taxable", "Exempt", "Deductible", "Non-Deductible", "Contra", "Uncertain"];
const SECTIONS = ["Sec 80C", "Sec 80D", "Sec 80TTA", "Sec 44ADA", "Sec 37(1)", "Sec 17(1)", "N/A", "uncertain"];

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

  const handleOverride = async (index, field, newValue) => {
    const txn = transactions[index];
    
    // Update UI immediately
    const updated = [...transactions];
    updated[index][field] = newValue;
    setTransactions(updated);

    // Call override API for feedback loop
    try {
      await axios.post('http://localhost:5000/api/v1/transactions/override', {
        clientId: "507f1f77bcf86cd799439011",
        description: txn.description,
        newHead: updated[index].itrHead,
        newTaxTreatment: updated[index].taxTreatment,
        newSection: updated[index].relevantSection
      });
    } catch (err) {
      console.error("Failed to save override rule", err);
    }
  };

  return (
    <div className="container">
      <header className="header">
        <h1>cellTax - TaxPrep Assistant</h1>
        <p>Upload a client's bank statement (CSV) to map transactions to ITR Schedules.</p>
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2>Categorized Transactions</h2>
              <button onClick={() => exportToExcel(transactions)} className="upload-btn" style={{ background: '#10B981' }}>
                Export Working Paper
              </button>
            </div>
            
            <div className="table-container">
              <table className="transactions-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Description</th>
                    <th>Amount</th>
                    <th>Dir</th>
                    <th>ITR Head</th>
                    <th>Treatment</th>
                    <th>Section</th>
                    <th>Engine & Reasoning</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((txn, index) => {
                    const isUncertain = txn.itrHead?.includes('Uncertain');
                    return (
                    <tr key={index} className={isUncertain ? "low-confidence" : "high-confidence"}>
                      <td>{new Date(txn.date).toLocaleDateString()}</td>
                      <td>{txn.description}</td>
                      <td className={txn.transactionDirection?.toLowerCase() === 'debit' ? 'amt-debit' : 'amt-credit'}>
                        {txn.amount}
                      </td>
                      <td className={txn.transactionDirection?.toLowerCase() === 'debit' ? 'type-debit' : 'type-credit'}>
                        {txn.transactionDirection || txn.type}
                      </td>
                      
                      {/* ITR Head Dropdown */}
                      <td>
                        <select 
                          value={txn.itrHead || "Uncertain - Needs Manual Review"}
                          onChange={(e) => handleOverride(index, 'itrHead', e.target.value)}
                          className="category-select"
                        >
                          {ITR_HEADS.map(h => <option key={h} value={h}>{h}</option>)}
                          {!ITR_HEADS.includes(txn.itrHead) && txn.itrHead && <option value={txn.itrHead}>{txn.itrHead}</option>}
                        </select>
                      </td>

                      {/* Tax Treatment Dropdown */}
                      <td>
                        <select 
                          value={txn.taxTreatment || "Uncertain"}
                          onChange={(e) => handleOverride(index, 'taxTreatment', e.target.value)}
                          className="category-select"
                          style={{width: '120px'}}
                        >
                          {TAX_TREATMENTS.map(t => <option key={t} value={t}>{t}</option>)}
                          {!TAX_TREATMENTS.includes(txn.taxTreatment) && txn.taxTreatment && <option value={txn.taxTreatment}>{txn.taxTreatment}</option>}
                        </select>
                      </td>

                      {/* Section Dropdown */}
                      <td>
                        <select 
                          value={txn.relevantSection || "N/A"}
                          onChange={(e) => handleOverride(index, 'relevantSection', e.target.value)}
                          className="category-select"
                          style={{width: '90px'}}
                        >
                          {SECTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                          {!SECTIONS.includes(txn.relevantSection) && txn.relevantSection && <option value={txn.relevantSection}>{txn.relevantSection}</option>}
                        </select>
                      </td>

                      <td className="reasoning-cell" style={{fontSize: '0.85rem'}}>
                        <strong>{txn.engine}</strong>: {txn.reasoning}
                      </td>
                    </tr>
                  )})}
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
