import { CSVParser, BankingCSVParser, csvUtils, bankingUtils } from './index';

// Example 1: Basic CSV parsing
export async function basicCSVExample() {
  console.log('=== Basic CSV Parsing Example ===');
  
  const parser = new CSVParser();
  
  // Parse CSV content
  const csvContent = `"","From","Routing","Reason","Amount","Balance","Date"
"84651091","LS Bets","030016036","Gateway Payment","-$2,500","240313","07/Aug/2025 23:13"
"84649763","San Andreas Government","020000028","Unemployment Insurance","+$500","242813","07/Aug/2025 22:48"`;
  
  const table = parser.parse(csvContent);
  console.log('Headers:', table.headers);
  console.log('Total rows:', table.totalRows);
  console.log('First row:', table.rows[0]);
  
  // Get specific column
  const amounts = parser.getColumn(table, 'Amount');
  console.log('Amounts:', amounts);
  
  // Filter rows
  const positiveAmounts = parser.filterRows(table, row => 
    row['Amount'].includes('+')
  );
  console.log('Positive amounts:', positiveAmounts);
  
  // Search rows
  const searchResults = parser.searchRows(table, 'Government');
  console.log('Search results for "Government":', searchResults);
}

// Example 2: Banking-specific parsing
export async function bankingCSVExample() {
  console.log('\n=== Banking CSV Parsing Example ===');
  
  const parser = new BankingCSVParser();
  
  // Parse banking CSV content
  const csvContent = `"","From","Routing","Reason","Amount","Balance","Date"
"84651091","LS Bets","030016036","Gateway Payment","-$2,500","240313","07/Aug/2025 23:13"
"84649763","San Andreas Government","020000028","Unemployment Insurance","+$500","242813","07/Aug/2025 22:48"
"84646624","San Andreas Government","020000028","Unemployment Insurance","+$500","242313","07/Aug/2025 21:48"`;
  
  const bankingTable = parser.parseBankingData(csvContent);
  console.log('Total transactions:', bankingTable.totalTransactions);
  console.log('Total amount:', bankingTable.totalAmount);
  console.log('Summary:', bankingTable.summary);
  console.log('Date range:', bankingTable.dateRange);
  
  // Get transactions by type
  const deposits = parser.getTransactionsByType(bankingTable, 'deposits');
  const withdrawals = parser.getTransactionsByType(bankingTable, 'withdrawals');
  console.log('Deposits count:', deposits.length);
  console.log('Withdrawals count:', withdrawals.length);
  
  // Get transactions by entity
  const governmentTransactions = parser.getTransactionsByEntity(bankingTable, 'Government');
  console.log('Government transactions:', governmentTransactions.length);
  
  // Get monthly summary
  const monthlySummary = parser.getMonthlySummary(bankingTable);
  console.log('Monthly summary:', monthlySummary);
}

// Example 3: File handling utilities
export async function fileHandlingExample() {
  console.log('\n=== File Handling Example ===');
  
  // Validate CSV content
  const validCSV = `"","From","Routing","Reason","Amount","Balance","Date"
"84651091","LS Bets","030016036","Gateway Payment","-$2,500","240313","07/Aug/2025 23:13"`;
  
  const isValid = csvUtils.isValidCSV(validCSV);
  console.log('Is valid CSV:', isValid);
  
  const isValidBanking = bankingUtils.isValidBankingCSV(validCSV);
  console.log('Is valid banking CSV:', isValidBanking);
}

// Example 4: Advanced operations
export async function advancedOperationsExample() {
  console.log('\n=== Advanced Operations Example ===');
  
  const parser = new BankingCSVParser();
  
  const csvContent = `"","From","Routing","Reason","Amount","Balance","Date"
"84651091","LS Bets","030016036","Gateway Payment","-$2,500","240313","07/Aug/2025 23:13"
"84649763","San Andreas Government","020000028","Unemployment Insurance","+$500","242813","07/Aug/2025 22:48"
"84646624","San Andreas Government","020000028","Unemployment Insurance","+$500","242313","07/Aug/2025 21:48"
"84642108","San Andreas Government","020000028","Unemployment Insurance","+$500","241813","07/Aug/2025 20:48"`;
  
  const bankingTable = parser.parseBankingData(csvContent);
  
  // Get transactions by amount range
  const largeTransactions = parser.getTransactionsByAmountRange(bankingTable, 1000, 5000);
  console.log('Large transactions (>$1000):', largeTransactions.length);
  
  // Get transactions by date range
  const recentTransactions = parser.getTransactionsByDateRange(
    bankingTable, 
    '06/Aug/2025 00:00', 
    '07/Aug/2025 23:59'
  );
  console.log('Recent transactions:', recentTransactions.length);
  
  // Export to CSV
  const exportedCSV = parser.exportBankingData(bankingTable);
  console.log('Exported CSV length:', exportedCSV.length);
  console.log('Exported CSV preview:', exportedCSV.substring(0, 200) + '...');
}

// Example 5: Error handling and edge cases
export async function errorHandlingExample() {
  console.log('\n=== Error Handling Example ===');
  
  const parser = new CSVParser();
  
  // Handle empty content
  const emptyTable = parser.parse('');
  console.log('Empty table:', emptyTable);
  
  // Handle malformed CSV
  const malformedCSV = `"Header1","Header2"
"Value1","Value2","ExtraValue"`;
  const malformedTable = parser.parse(malformedCSV);
  console.log('Malformed CSV table:', malformedTable);
  
  // Handle CSV with empty headers
  const emptyHeadersCSV = `"","Header2","Header3"
"Value1","Value2","Value3"`;
  const emptyHeadersTable = parser.parse(emptyHeadersCSV);
  console.log('Empty headers table:', emptyHeadersTable);
}

// Run all examples
export async function runAllExamples() {
  try {
    await basicCSVExample();
    await bankingCSVExample();
    await fileHandlingExample();
    await advancedOperationsExample();
    await errorHandlingExample();
    
    console.log('\n=== All examples completed successfully! ===');
  } catch (error) {
    console.error('Error running examples:', error);
  }
}

// Export individual examples for testing
export {
  basicCSVExample,
  bankingCSVExample,
  fileHandlingExample,
  advancedOperationsExample,
  errorHandlingExample
};
