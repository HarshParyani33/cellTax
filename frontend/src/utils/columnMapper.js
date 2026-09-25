export function parseRawExcelData(rawData) {
  if (!rawData || rawData.length === 0) return null;

  let headerOffset = 0;
  let sampleRow = rawData[0];

  // 1. Header-row detection
  // If no cell in the first row parses as a number or a date (assuming they aren't empty), it's likely a header.
  const isLikelyHeader = sampleRow.every(cell => {
    if (!cell) return true;
    const str = cell.toString().trim();
    if (!str) return true;
    const num = parseFloat(str.replace(/,/g, ''));
    const isNum = !isNaN(num);
    // basic date check: matches DD-MM-YYYY, YYYY-MM-DD, or DD/MM/YYYY
    const isDate = /^\d{1,4}[-/]\d{1,2}[-/]\d{1,4}/.test(str);
    return !isNum && !isDate;
  });

  if (isLikelyHeader && rawData.length > 1) {
    headerOffset = 1;
    sampleRow = rawData[1];
  }

  const numCols = sampleRow.length;
  
  // Analyze columns based on all data rows
  const colTypes = Array(numCols).fill(null).map(() => ({
    isNumeric: true,
    isDate: true,
    isDirStr: true,
    avgLength: 0,
    nonEmptyCount: 0
  }));

  const dataRows = rawData.slice(headerOffset);
  
  dataRows.forEach(row => {
    row.forEach((cell, colIdx) => {
      if (colIdx >= numCols) return;
      const str = (cell || "").toString().trim();
      if (!str) return;
      
      colTypes[colIdx].nonEmptyCount++;
      colTypes[colIdx].avgLength += str.length;

      const num = parseFloat(str.replace(/,/g, ''));
      if (isNaN(num)) colTypes[colIdx].isNumeric = false;
      
      if (!/^\d{1,4}[-/a-zA-Z]{1,4}[-/]\d{1,4}/.test(str) && isNaN(Date.parse(str))) {
        colTypes[colIdx].isDate = false;
      }
      
      const lower = str.toLowerCase();
      if (!['dr', 'cr', 'debit', 'credit'].includes(lower)) {
        colTypes[colIdx].isDirStr = false;
      }
    });
  });

  colTypes.forEach(c => {
    if (c.nonEmptyCount > 0) {
      c.avgLength = c.avgLength / c.nonEmptyCount;
    }
  });

  const mapping = {
    dateIdx: -1,
    descIdx: -1,
    amountIdx: -1,
    typeIdx: -1,
    creditIdx: -1, // for two-column Dr/Cr
    debitIdx: -1,
    confidence: "High",
    hasHeader: headerOffset === 1
  };

  // Find Date
  mapping.dateIdx = colTypes.findIndex(c => c.isDate && c.nonEmptyCount > 0);

  // Find Dr/Cr explicit string col
  mapping.typeIdx = colTypes.findIndex(c => c.isDirStr && c.nonEmptyCount > 0);

  // Find Amounts
  const numericCols = colTypes.map((c, idx) => ({...c, idx})).filter(c => c.isNumeric && c.nonEmptyCount > 0 && c.idx !== mapping.dateIdx);
  
  if (numericCols.length >= 2) {
    // Check for separate Debit/Credit columns
    // Characteristic: They rarely have values in BOTH columns for the same row.
    const colA = numericCols[numericCols.length - 2].idx; // often second to last
    const colB = numericCols[numericCols.length - 1].idx; // often last
    
    let mutualExclusions = 0;
    dataRows.forEach(row => {
      const aHasVal = parseFloat(row[colA]?.toString().replace(/,/g, '')) > 0;
      const bHasVal = parseFloat(row[colB]?.toString().replace(/,/g, '')) > 0;
      if ((aHasVal && !bHasVal) || (!aHasVal && bHasVal)) {
        mutualExclusions++;
      }
    });

    if (mutualExclusions / dataRows.length > 0.8) {
      // High likelihood of separate Dr/Cr columns
      mapping.debitIdx = colA; // Conventionally Debit is first
      mapping.creditIdx = colB;
    } else {
      mapping.amountIdx = numericCols[numericCols.length - 1].idx;
    }
  } else if (numericCols.length === 1) {
    mapping.amountIdx = numericCols[0].idx;
  }

  // Find Description
  // Any column not already mapped is a candidate. Pick the one with the highest avg length.
  // Tie-breaker: pick the rightmost column (larger index), as ID/Refs are usually on the left.
  const textCols = colTypes.map((c, idx) => ({...c, idx}))
    .filter(c => c.idx !== mapping.dateIdx && c.idx !== mapping.amountIdx && c.idx !== mapping.typeIdx && c.idx !== mapping.debitIdx && c.idx !== mapping.creditIdx && c.nonEmptyCount > 0)
    .sort((a, b) => {
      const diff = b.avgLength - a.avgLength;
      if (Math.abs(diff) < 5) {
        return b.idx - a.idx; // Prefer rightmost (larger index) for tie-breaker
      }
      return diff;
    });

  if (textCols.length > 0) {
    mapping.descIdx = textCols[0].idx;
    if (textCols.length > 1 && Math.abs(textCols[0].avgLength - textCols[1].avgLength) < 10) {
      mapping.confidence = "Low";
      mapping.altDescIdx = textCols[1].idx;
    }
  }

  return { mapping, dataRows };
}

export function formatTransactions(dataRows, mapping) {
  return dataRows.map(row => {
    let amount = 0;
    let dir = "Debit"; // default
    
    if (mapping.debitIdx !== -1 && mapping.creditIdx !== -1) {
      const drVal = parseFloat((row[mapping.debitIdx] || "").toString().replace(/,/g, ''));
      const crVal = parseFloat((row[mapping.creditIdx] || "").toString().replace(/,/g, ''));
      if (!isNaN(crVal) && crVal > 0) {
        amount = crVal;
        dir = "Credit";
      } else {
        amount = isNaN(drVal) ? 0 : drVal;
        dir = "Debit";
      }
    } else {
      amount = parseFloat((row[mapping.amountIdx] || "").toString().replace(/,/g, ''));
      if (amount < 0) {
        dir = "Debit";
        amount = Math.abs(amount);
      } else if (mapping.typeIdx !== -1) {
        const typeStr = (row[mapping.typeIdx] || "").toString().toLowerCase();
        dir = typeStr.includes("cr") || typeStr.includes("credit") ? "Credit" : "Debit";
      }
    }

    return {
      date: mapping.dateIdx !== -1 ? row[mapping.dateIdx] : new Date().toISOString(),
      description: mapping.descIdx !== -1 ? row[mapping.descIdx] : "Unknown",
      amount: isNaN(amount) ? 0 : amount,
      type: dir
    };
  });
}
