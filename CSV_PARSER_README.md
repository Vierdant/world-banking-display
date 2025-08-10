# CSV Parser for World Banking Display

A comprehensive CSV parsing system designed specifically for banking transaction data, with support for general CSV files and specialized banking operations.

## Features

### 🚀 Core CSV Parser
- **Robust CSV parsing** with proper quote handling
- **Empty header detection** and automatic naming
- **Whitespace trimming** and empty row filtering
- **Escaped quote support** (e.g., `""` for literal quotes)
- **Malformed CSV handling** with graceful fallbacks

### 🏦 Banking-Specific Features
- **Typed transaction objects** with proper interfaces
- **Amount parsing** for currency strings like `+$500`, `-$2,500`
- **Date parsing** for formats like `07/Aug/2025 23:13`
- **Transaction categorization** (deposits vs withdrawals)
- **Financial calculations** (totals, averages, summaries)
- **Monthly reporting** and date range filtering

### 🔧 Utility Functions
- **File upload handling** from browser File objects
- **URL-based CSV loading** for remote files
- **CSV validation** to ensure proper format
- **Export functionality** back to CSV format
- **Search and filtering** across all columns
- **Sorting** by any column with custom ordering

## Installation

The CSV parser is already included in your project. Import it from the lib directory:

```typescript
import { CSVParser, BankingCSVParser, csvUtils, bankingUtils } from '../lib';
```

## Quick Start

### Basic CSV Parsing

```typescript
import { CSVParser } from '../lib';

const parser = new CSVParser();
const csvContent = `"Name","Age","City"
"John","25","New York"
"Jane","30","Los Angeles"`;

const table = parser.parse(csvContent);
console.log(table.headers); // ["Name", "Age", "City"]
console.log(table.totalRows); // 2
console.log(table.rows[0]); // { Name: "John", Age: "25", City: "New York" }
```

### Banking CSV Parsing

```typescript
import { BankingCSVParser } from '../lib';

const parser = new BankingCSVParser();
const csvContent = `"","From","Routing","Reason","Amount","Balance","Date"
"84651091","LS Bets","030016036","Gateway Payment","-$2,500","240313","07/Aug/2025 23:13"`;

const bankingTable = parser.parseBankingData(csvContent);
console.log(bankingTable.transactions[0].amount); // -2500
console.log(bankingTable.summary.deposits); // 0
console.log(bankingTable.summary.withdrawals); // 2500
```

## API Reference

### CSVParser Class

#### Constructor
```typescript
new CSVParser(options?: CSVParseOptions)
```

#### Options
```typescript
interface CSVParseOptions {
  skipEmptyRows?: boolean;      // Default: true
  trimWhitespace?: boolean;     // Default: true
  handleEmptyHeaders?: boolean; // Default: true
}
```

#### Methods

##### `parse(csvContent: string): CSVTable`
Parses CSV content and returns a structured table.

##### `getColumn(table: CSVTable, headerName: string): string[]`
Extracts all values from a specific column.

##### `filterRows(table: CSVTable, predicate: (row: CSVRow) => boolean): CSVRow[]`
Filters rows based on a custom predicate function.

##### `sortRows(table: CSVTable, headerName: string, ascending?: boolean): CSVRow[]`
Sorts rows by a specific column.

##### `searchRows(table: CSVTable, searchTerm: string): CSVRow[]`
Searches for rows containing the search term in any column.

##### `getUniqueValues(table: CSVTable, headerName: string): string[]`
Gets unique values from a specific column.

##### `getColumnStats(table: CSVTable, headerName: string): ColumnStats`
Calculates statistics for numeric columns.

##### `exportToCSV(table: CSVTable): string`
Exports the table back to CSV format.

### BankingCSVParser Class

Extends `CSVParser` with banking-specific functionality.

#### Methods

##### `parseBankingData(csvContent: string): BankingCSVTable`
Parses banking CSV data with proper typing and calculations.

##### `getTransactionsByType(table: BankingCSVTable, type: 'deposits' | 'withdrawals' | 'all'): BankingTransaction[]`
Filters transactions by type.

##### `getTransactionsByDateRange(table: BankingCSVTable, startDate: string, endDate: string): BankingTransaction[]`
Filters transactions within a date range.

##### `getTransactionsByAmountRange(table: BankingCSVTable, minAmount: number, maxAmount: number): BankingTransaction[]`
Filters transactions within an amount range.

##### `getTransactionsByEntity(table: BankingCSVTable, entityName: string): BankingTransaction[]`
Searches for transactions involving a specific entity.

##### `getMonthlySummary(table: BankingCSVTable): MonthlySummary`
Generates monthly transaction summaries.

##### `exportBankingData(table: BankingCSVTable): string`
Exports banking data to CSV format.

### Utility Functions

#### `csvUtils.parseFile(file: File, options?: CSVParseOptions): Promise<CSVTable>`
Parses a CSV file from a browser File object.

#### `csvUtils.parseFromURL(url: string, options?: CSVParseOptions): Promise<CSVTable>`
Parses a CSV file from a URL.

#### `csvUtils.isValidCSV(content: string): boolean`
Validates if content looks like valid CSV.

#### `bankingUtils.parseBankingFile(file: File): Promise<BankingCSVTable>`
Parses a banking CSV file from a browser File object.

#### `bankingUtils.parseBankingFromURL(url: string): Promise<BankingCSVTable>`
Parses a banking CSV file from a URL.

#### `bankingUtils.isValidBankingCSV(content: string): boolean`
Validates if content looks like valid banking CSV.

## Data Types

### CSVRow
```typescript
interface CSVRow {
  [key: string]: string;
}
```

### CSVTable
```typescript
interface CSVTable {
  headers: string[];
  rows: CSVRow[];
  totalRows: number;
}
```

### BankingTransaction
```typescript
interface BankingTransaction {
  transactionId: string;
  from: string;
  routing: string;
  reason: string;
  amount: number;
  balance: string;
  date: string;
  rawRow: CSVRow;
}
```

### BankingCSVTable
```typescript
interface BankingCSVTable {
  transactions: BankingTransaction[];
  totalTransactions: number;
  totalAmount: number;
  averageAmount: number;
  dateRange: { start: string; end: string };
  summary: {
    deposits: number;
    withdrawals: number;
    netChange: number;
  };
}
```

## Usage Examples

### File Upload Handling

```typescript
async function handleFileUpload(event: Event) {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  
  if (file) {
    try {
      const bankingTable = await bankingUtils.parseBankingFile(file);
      console.log('Parsed transactions:', bankingTable.transactions.length);
    } catch (error) {
      console.error('Failed to parse file:', error);
    }
  }
}
```

### Advanced Filtering

```typescript
const parser = new BankingCSVParser();

// Get large deposits
const largeDeposits = parser
  .getTransactionsByType(bankingTable, 'deposits')
  .filter(t => t.amount > 1000);

// Get recent transactions
const recentTransactions = parser.getTransactionsByDateRange(
  bankingTable,
  '01/Aug/2025 00:00',
  '31/Aug/2025 23:59'
);

// Search for specific entities
const governmentTransactions = parser.getTransactionsByEntity(
  bankingTable,
  'Government'
);
```

### Data Export

```typescript
// Export to CSV
const csvContent = parser.exportBankingData(bankingTable);

// Download file
const blob = new Blob([csvContent], { type: 'text/csv' });
const url = URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url;
a.download = 'banking-data.csv';
a.click();
URL.revokeObjectURL(url);
```

## Demo Component

A complete demo component is available at `src/routes/csv-demo.svelte` that showcases:

- File upload and parsing
- Data visualization with summary statistics
- Search and filtering capabilities
- Sorting and data export
- Real-time data manipulation

## Error Handling

The parser handles various edge cases gracefully:

- **Empty files**: Returns empty table structure
- **Malformed CSV**: Attempts to parse what it can
- **Missing columns**: Fills with empty strings
- **Invalid dates**: Falls back to standard Date parsing
- **Invalid amounts**: Returns NaN for calculations

## Performance Considerations

- **Large files**: The parser processes files line by line for memory efficiency
- **Search operations**: Use specific column searches when possible for better performance
- **Sorting**: Consider pre-sorting data if frequent sorting is needed
- **Memory usage**: Large CSV files are processed incrementally

## Browser Compatibility

- **Modern browsers**: Full support for all features
- **File API**: Required for file upload functionality
- **Fetch API**: Required for URL-based loading
- **ES6+ features**: Uses modern JavaScript features

## Contributing

The CSV parser is designed to be extensible. To add new features:

1. Extend the base `CSVParser` class for general CSV features
2. Extend `BankingCSVParser` for banking-specific features
3. Add utility functions to the appropriate utils object
4. Update types and interfaces as needed
5. Add comprehensive tests for new functionality

## License

This CSV parser is part of the World Banking Display project and follows the same licensing terms.
