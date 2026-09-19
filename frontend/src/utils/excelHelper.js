/**
 * Helper to write categorized transaction data back to Excel.
 * @param {Array} transactions 
 */
export const exportToExcel = async (transactions) => {
  // Check if we are genuinely running inside an Excel Host, not just a browser
  if (!window.Office || !window.Office.context || !window.Office.context.document) {
    console.error("Export failed: Not running inside Excel. Please sideload the add-in in Excel to use this feature.");
    return;
  }

  try {
    await window.Excel.run(async (context) => {
      const sheets = context.workbook.worksheets;
      // Create a new sheet for the exported data
      const sheet = sheets.add("ITR Draft " + new Date().getTime().toString().slice(-4));
      
      // Define the headers
      const headers = [["Date", "Description", "Amount", "Type", "Final Category"]];
      
      // Map data to a 2D array
      const dataRows = transactions.map(txn => [
        new Date(txn.date).toLocaleDateString(),
        txn.description,
        txn.amount,
        txn.type,
        txn.proposedCategory || "Uncategorized"
      ]);
      
      const allData = headers.concat(dataRows);
      
      // Get the range based on data size
      const rangeAddress = `A1:E${allData.length}`;
      const range = sheet.getRange(rangeAddress);
      range.values = allData;
      
      // Format as a Table
      const table = sheet.tables.add(rangeAddress, true /* hasHeaders */);
      table.name = "TaxData" + new Date().getTime().toString().slice(-4);
      table.tableStyle = "TableStyleMedium16"; // A sleek dark blue style

      // Format the Amount column (Column C) as Currency
      const amountRange = sheet.getRange(`C2:C${allData.length}`);
      amountRange.numberFormat = [["₹#,##0.00"]];

      // Format headers
      const headerRange = sheet.getRange("A1:E1");
      headerRange.format.font.bold = true;
      headerRange.format.font.color = "white";
      headerRange.format.fill.color = "#4F46E5"; // Indigo brand color

      // Auto-fit columns
      range.format.autofitColumns();
      
      // Freeze the top row so headers stay visible when scrolling
      sheet.freezePanes.freezeRows(1);
      
      // Make the new sheet active
      sheet.activate();
      
      await context.sync();
    });
  } catch (error) {
    console.error("Error writing to Excel:", error);
    alert("Failed to write to Excel: " + error.message);
  }
};
