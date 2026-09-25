import { useState, useMemo } from 'react';
import Papa from 'papaparse';
import axios from 'axios';
import { exportToExcel } from './utils/excelHelper';
import { CustomSelect } from './components/CustomSelect';
import { parseRawExcelData, formatTransactions } from './utils/columnMapper';
import './App.css';

const ITR_HEADS = ["Salary", "House Property", "PGBP", "Capital Gains", "IFOS", "Chapter VI-A Deduction", "Not Applicable (Personal/Transfer)", "Uncertain - Needs Manual Review"];
const TAX_TREATMENTS = ["Taxable", "Exempt", "Deductible", "Non-Deductible", "Contra", "Uncertain"];
const SECTIONS = ["Sec 80C", "Sec 80D", "Sec 80TTA", "Sec 44ADA", "Sec 37(1)", "Sec 17(1)", "N/A", "uncertain"];

function App() {
  const [file, setFile] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Bulk Edit State
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedIndices, setSelectedIndices] = useState(new Set());
  const [bulkItrHead, setBulkItrHead] = useState("");
  const [bulkTaxTreatment, setBulkTaxTreatment] = useState("");
  const [bulkSection, setBulkSection] = useState("");

  // Mapping Confirmation State
  const [mappingState, setMappingState] = useState(null); // { mapping, dataRows }

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
    setError(null);
  };

  const executePipeline = async (mappedTransactions) => {
    setLoading(true);
    setError(null);
    try {
      const clientId = "507f1f77bcf86cd799439011"; 
      const response = await axios.post(`/api/v1/transactions/batch/${clientId}`, {
        transactions: mappedTransactions
      });

      if (response.data && response.data.data) {
        setTransactions(response.data.data);
        setSelectedIndices(new Set());
        setSearchTerm("");
        setMappingState(null);
      }
    } catch (err) {
      console.error(err);
      setError("Failed to process transactions. Is the backend running?");
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = () => {
    if (!file) {
      setError("Please select a file first.");
      return;
    }
    setLoading(true);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const mappedTransactions = results.data.map((row) => ({
          date: row.Date || row.date || new Date().toISOString(),
          description: row.Description || row.Narration || row.description || row.narration || "Unknown",
          amount: parseFloat(row.Amount || row.amount || row.Withdrawal || row.Deposit || 0),
          type: (row.Type || row.type || "Debit").trim(),
        }));
        await executePipeline(mappedTransactions);
      },
      error: (err) => {
        setError("Error parsing CSV: " + err.message);
        setLoading(false);
      }
    });
  };

  const handleProcessSelectedRows = async () => {
    setError(null);
    try {
      if (!window.Excel) {
        setError("Office.js is not loaded. Run inside Excel.");
        return;
      }
      await window.Excel.run(async (context) => {
        const range = context.workbook.getSelectedRange();
        range.load("text");
        await context.sync();

        if (range.text.length === 0) {
          setError("No rows selected.");
          return;
        }

        const parsed = parseRawExcelData(range.text);
        if (!parsed) {
          setError("Could not parse selection.");
          return;
        }

        setMappingState(parsed);
      });
    } catch (err) {
      console.error(err);
      setError("Failed to read from Excel: " + err.message);
    }
  };

  const confirmMapping = () => {
    const mappedTransactions = formatTransactions(mappingState.dataRows, mappingState.mapping);
    executePipeline(mappedTransactions);
  };

  const handleOverride = async (index, field, newValue) => {
    const txn = transactions[index];
    const updated = [...transactions];
    updated[index][field] = newValue;
    setTransactions(updated);

    try {
      await axios.post('/api/v1/transactions/override', {
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

  const handleBulkUpdate = () => {
    if (selectedIndices.size === 0) return;
    
    const updated = [...transactions];
    selectedIndices.forEach(index => {
      if (bulkItrHead) updated[index].itrHead = bulkItrHead;
      if (bulkTaxTreatment) updated[index].taxTreatment = bulkTaxTreatment;
      if (bulkSection) updated[index].relevantSection = bulkSection;
      
      axios.post('/api/v1/transactions/override', {
        clientId: "507f1f77bcf86cd799439011",
        description: updated[index].description,
        newHead: updated[index].itrHead,
        newTaxTreatment: updated[index].taxTreatment,
        newSection: updated[index].relevantSection
      }).catch(console.error);
    });

    setTransactions(updated);
    setSelectedIndices(new Set());
    setBulkItrHead("");
    setBulkTaxTreatment("");
    setBulkSection("");
  };

  const filteredTransactions = useMemo(() => {
    const lowerSearch = searchTerm.toLowerCase();
    return transactions.map((txn, idx) => ({ ...txn, originalIndex: idx })).filter(txn => {
      if (!lowerSearch) return true;
      return (
        txn.description.toLowerCase().includes(lowerSearch) ||
        (txn.itrHead && txn.itrHead.toLowerCase().includes(lowerSearch)) ||
        (txn.taxTreatment && txn.taxTreatment.toLowerCase().includes(lowerSearch)) ||
        (txn.engine && txn.engine.toLowerCase().includes(lowerSearch)) ||
        txn.amount.toString().includes(lowerSearch)
      );
    });
  }, [transactions, searchTerm]);

  const toggleSelection = (originalIndex) => {
    const newSelection = new Set(selectedIndices);
    if (newSelection.has(originalIndex)) newSelection.delete(originalIndex);
    else newSelection.add(originalIndex);
    setSelectedIndices(newSelection);
  };

  const toggleAllFiltered = () => {
    const newSelection = new Set(selectedIndices);
    if (filteredTransactions.every(txn => selectedIndices.has(txn.originalIndex))) {
      filteredTransactions.forEach(txn => newSelection.delete(txn.originalIndex));
    } else {
      filteredTransactions.forEach(txn => newSelection.add(txn.originalIndex));
    }
    setSelectedIndices(newSelection);
  };

  // Helper for generating column letters (A, B, C...)
  const colLetter = (idx) => idx >= 0 ? String.fromCharCode(65 + idx) : "None";

  return (
    <div className="container">
      <header className="header">
        <h1>cellTax</h1>
        <p>Map transactions to ITR Schedules.</p>
      </header>

      <main className="main-content">
        <section className="upload-section">
          <input 
            type="file" 
            accept=".csv" 
            onChange={handleFileChange} 
            className="file-input" 
          />
          <button onClick={handleUpload} disabled={!file || loading} className="upload-btn">
            {loading ? "Processing..." : "Upload CSV"}
          </button>
          
          <div style={{ textAlign: 'center', margin: '0.5rem 0', color: '#6B7280', fontSize: '0.85rem' }}>OR</div>
          
          <button onClick={handleProcessSelectedRows} disabled={loading} className="upload-btn" style={{ background: '#107C41', borderColor: '#0B5A2F' }}>
            Process Selected Excel Rows
          </button>
          
          {error && <p className="error">{error}</p>}
        </section>

        {mappingState && (
          <section className="mapping-confirmation" style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', padding: '1rem', marginBottom: '1.5rem' }}>
            <h3 style={{ marginTop: 0, fontSize: '1rem', color: '#1E3A8A' }}>Confirm Column Mapping</h3>
            {mappingState.mapping.hasHeader && <p style={{ fontSize: '0.85rem', color: '#4B5563', margin: '0 0 10px 0' }}>✓ Detected and skipped header row.</p>}
            {mappingState.mapping.confidence === "Low" && <p style={{ fontSize: '0.85rem', color: '#92400E', margin: '0 0 10px 0', background: '#FEF3C7', padding: '5px' }}>⚠️ Low confidence on Description column. Did you mean Col {colLetter(mappingState.mapping.altDescIdx)}?</p>}
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.85rem', marginBottom: '1rem' }}>
              <div><strong>Date:</strong> Col {colLetter(mappingState.mapping.dateIdx)}</div>
              <div><strong>Desc:</strong> Col {colLetter(mappingState.mapping.descIdx)}</div>
              {mappingState.mapping.debitIdx !== -1 ? (
                <>
                  <div><strong>Debit:</strong> Col {colLetter(mappingState.mapping.debitIdx)}</div>
                  <div><strong>Credit:</strong> Col {colLetter(mappingState.mapping.creditIdx)}</div>
                </>
              ) : (
                <>
                  <div><strong>Amount:</strong> Col {colLetter(mappingState.mapping.amountIdx)}</div>
                  <div><strong>Direction:</strong> {mappingState.mapping.typeIdx !== -1 ? `Col ${colLetter(mappingState.mapping.typeIdx)}` : 'Inferred from sign'}</div>
                </>
              )}
            </div>
            
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button onClick={confirmMapping} className="upload-btn" style={{ padding: '0.4rem', fontSize: '0.85rem' }}>Looks right</button>
              <button onClick={() => setMappingState(null)} className="upload-btn" style={{ background: '#E5E7EB', color: '#374151', borderColor: '#D1D5DB', padding: '0.4rem', fontSize: '0.85rem' }}>Cancel</button>
            </div>
          </section>
        )}

        {transactions.length > 0 && !mappingState && (
          <section className="results-section">
            <div className="results-header">
              <h2>Transactions ({transactions.length})</h2>
              <button onClick={async () => {
                setError(null);
                try {
                  await exportToExcel(transactions);
                } catch (err) {
                  setError(err.message);
                }
              }} className="upload-btn export-btn">
                Export
              </button>
            </div>

            <div className="bulk-bar">
              <input 
                type="text" 
                placeholder="Search..." 
                className="search-input"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              
              <div className="bulk-actions">
                <span className="selection-count">
                  {selectedIndices.size} sel
                </span>
                <div className="bulk-dropdowns">
                  <CustomSelect 
                    options={ITR_HEADS}
                    value={bulkItrHead}
                    onChange={setBulkItrHead}
                    placeholder="-- Change Head --"
                  />
                  <CustomSelect 
                    options={TAX_TREATMENTS}
                    value={bulkTaxTreatment}
                    onChange={setBulkTaxTreatment}
                    placeholder="-- Change Treatment --"
                  />
                  <CustomSelect 
                    options={SECTIONS}
                    value={bulkSection}
                    onChange={setBulkSection}
                    placeholder="-- Change Section --"
                  />
                </div>
                <button 
                  onClick={handleBulkUpdate} 
                  disabled={selectedIndices.size === 0 || (!bulkItrHead && !bulkTaxTreatment && !bulkSection)}
                  className="upload-btn apply-bulk-btn"
                >
                  Apply
                </button>
              </div>
            </div>
            
            <div className="table-container">
              <table className="transactions-table">
                <thead>
                  <tr>
                    <th style={{ width: '30px', textAlign: 'center' }}>
                      <input 
                        type="checkbox" 
                        checked={filteredTransactions.length > 0 && filteredTransactions.every(txn => selectedIndices.has(txn.originalIndex))}
                        onChange={toggleAllFiltered}
                      />
                    </th>
                    <th>Date</th>
                    <th>Description</th>
                    <th>Amount</th>
                    <th>ITR Head</th>
                    <th>Treatment</th>
                    <th>Section</th>
                    <th>Engine / Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTransactions.map((txn) => {
                    const isUncertain = txn.itrHead?.includes('Uncertain');
                    const isSelected = selectedIndices.has(txn.originalIndex);
                    
                    return (
                    <tr key={txn.originalIndex} className={`${isUncertain ? "low-confidence" : "high-confidence"} ${isSelected ? "row-selected" : ""}`}>
                      <td style={{ textAlign: 'center' }}>
                        <input 
                          type="checkbox" 
                          checked={isSelected} 
                          onChange={() => toggleSelection(txn.originalIndex)} 
                        />
                      </td>
                      <td style={{ whiteSpace: 'nowrap' }}>{new Date(txn.date).toLocaleDateString(undefined, {month: 'short', day: 'numeric', year: '2-digit'})}</td>
                      <td className="desc-cell" title={txn.description}>{txn.description}</td>
                      <td className={txn.transactionDirection?.toLowerCase() === 'debit' ? 'amt-debit' : 'amt-credit'}>
                        {txn.amount}
                      </td>
                      
                      <td style={{ minWidth: '180px' }}>
                        <CustomSelect 
                          options={ITR_HEADS}
                          value={txn.itrHead || "Uncertain - Needs Manual Review"}
                          onChange={(newVal) => handleOverride(txn.originalIndex, 'itrHead', newVal)}
                        />
                      </td>

                      <td style={{ minWidth: '130px' }}>
                        <CustomSelect 
                          options={TAX_TREATMENTS}
                          value={txn.taxTreatment || "Uncertain"}
                          onChange={(newVal) => handleOverride(txn.originalIndex, 'taxTreatment', newVal)}
                        />
                      </td>

                      <td style={{ minWidth: '100px' }}>
                        <CustomSelect 
                          options={SECTIONS}
                          value={txn.relevantSection || "N/A"}
                          onChange={(newVal) => handleOverride(txn.originalIndex, 'relevantSection', newVal)}
                        />
                      </td>

                      <td className="reasoning-cell" title={txn.reasoning}>
                        <strong>{txn.engine}</strong> <span className="reasoning-text">{txn.reasoning}</span>
                      </td>
                    </tr>
                  )})}
                  
                  {filteredTransactions.length === 0 && (
                    <tr>
                      <td colSpan="8" style={{ textAlign: 'center', padding: '2rem', color: '#6B7280' }}>
                        No transactions match your search.
                      </td>
                    </tr>
                  )}
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
