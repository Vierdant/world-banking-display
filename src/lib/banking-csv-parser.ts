import { CSVParser } from './csv-parser';
import type { CSVTable, CSVRow } from './csv-parser';

export interface BankingTransaction {
  transactionId: string;
  from: string;
  routing: string;
  reason: string;
  amount: number;
  balance: string;
  date: string;
  rawRow: CSVRow;
}

export interface BankingCSVTable {
  transactions: BankingTransaction[];
  totalTransactions: number;
  totalAmount: number;
  averageAmount: number;
  dateRange: {
    start: string;
    end: string;
  };
  summary: {
    deposits: number;
    withdrawals: number;
    netChange: number;
  };
}

export class BankingCSVParser extends CSVParser {
  /**
   * Parse banking CSV data with proper typing
   */
  parseBankingData(csvContent: string): BankingCSVTable {
    const csvTable = this.parse(csvContent);
    const transactions = this.parseTransactions(csvTable);
    
    return {
      transactions,
      totalTransactions: transactions.length,
      totalAmount: this.calculateTotalAmount(transactions),
      averageAmount: this.calculateAverageAmount(transactions),
      dateRange: this.getDateRange(transactions),
      summary: this.calculateSummary(transactions)
    };
  }

  /**
   * Parse raw CSV rows into typed BankingTransaction objects
   */
  private parseTransactions(csvTable: CSVTable): BankingTransaction[] {
    return csvTable.rows.map(row => ({
      transactionId: row['TransactionID'] || row[''] || '',
      from: row['From'] || '',
      routing: row['Routing'] || '',
      reason: row['Reason'] || '',
      amount: this.parseAmount(row['Amount'] || ''),
      balance: row['Balance'] || '',
      date: row['Date'] || '',
      rawRow: row
    }));
  }

  /**
   * Calculate total amount across all transactions
   */
  private calculateTotalAmount(transactions: BankingTransaction[]): number {
    return transactions.reduce((sum, transaction) => sum + transaction.amount, 0);
  }

  /**
   * Calculate average amount across all transactions
   */
  private calculateAverageAmount(transactions: BankingTransaction[]): number {
    if (transactions.length === 0) return 0;
    return this.calculateTotalAmount(transactions) / transactions.length;
  }

  /**
   * Get the date range of transactions
   */
  private getDateRange(transactions: BankingTransaction[]): { start: string; end: string } {
    if (transactions.length === 0) {
      return { start: '', end: '' };
    }

    const dates = transactions.map(t => t.date).filter(d => d !== '');
    if (dates.length === 0) {
      return { start: '', end: '' };
    }

    // Simple date comparison (assuming DD/MMM/YYYY format)
    const sortedDates = dates.sort((a, b) => {
      const dateA = this.parseDate(a);
      const dateB = this.parseDate(b);
      return dateA.getTime() - dateB.getTime();
    });

    return {
      start: sortedDates[0],
      end: sortedDates[sortedDates.length - 1]
    };
  }

  /**
   * Calculate summary statistics
   */
  private calculateSummary(transactions: BankingTransaction[]): {
    deposits: number;
    withdrawals: number;
    netChange: number;
  } {
    let deposits = 0;
    let withdrawals = 0;

    transactions.forEach(transaction => {
      if (transaction.amount > 0) {
        deposits += transaction.amount;
      } else {
        withdrawals += Math.abs(transaction.amount);
      }
    });

    return {
      deposits,
      withdrawals,
      netChange: deposits - withdrawals
    };
  }

  /**
   * Parse date strings like "07/Aug/2025 23:13"
   */
  private parseDate(dateStr: string): Date {
    // Handle format: "07/Aug/2025 23:13"
    const match = dateStr.match(/(\d{2})\/(\w{3})\/(\d{4})\s+(\d{2}):(\d{2})/);
    if (match) {
      const [, day, month, year, hour, minute] = match;
      const monthIndex = this.getMonthIndex(month);
      return new Date(parseInt(year), monthIndex, parseInt(day), parseInt(hour), parseInt(minute));
    }
    
    // Fallback to standard date parsing
    return new Date(dateStr);
  }

  /**
   * Get month index from abbreviated month name
   */
  private getMonthIndex(month: string): number {
    const months: { [key: string]: number } = {
      'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'May': 4, 'Jun': 5,
      'Jul': 6, 'Aug': 7, 'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11
    };
    return months[month] || 0;
  }

  /**
   * Get transactions by date range
   */
  getTransactionsByDateRange(
    table: BankingCSVTable,
    startDate: string,
    endDate: string
  ): BankingTransaction[] {
    const start = this.parseDate(startDate);
    const end = this.parseDate(endDate);
    
    return table.transactions.filter(transaction => {
      const transactionDate = this.parseDate(transaction.date);
      return transactionDate >= start && transactionDate <= end;
    });
  }

  /**
   * Get transactions by amount range
   */
  getTransactionsByAmountRange(
    table: BankingCSVTable,
    minAmount: number,
    maxAmount: number
  ): BankingTransaction[] {
    return table.transactions.filter(transaction => 
      transaction.amount >= minAmount && transaction.amount <= maxAmount
    );
  }

  /**
   * Get transactions by sender/recipient
   */
  getTransactionsByEntity(
    table: BankingCSVTable,
    entityName: string
  ): BankingTransaction[] {
    const searchTerm = entityName.toLowerCase();
    return table.transactions.filter(transaction =>
      transaction.from.toLowerCase().includes(searchTerm) ||
      transaction.reason.toLowerCase().includes(searchTerm)
    );
  }

  /**
   * Get transactions by type (deposits/withdrawals)
   */
  getTransactionsByType(
    table: BankingCSVTable,
    type: 'deposits' | 'withdrawals' | 'all'
  ): BankingTransaction[] {
    switch (type) {
      case 'deposits':
        return table.transactions.filter(t => t.amount > 0);
      case 'withdrawals':
        return table.transactions.filter(t => t.amount < 0);
      default:
        return table.transactions;
    }
  }

  /**
   * Get monthly summary
   */
  getMonthlySummary(table: BankingCSVTable): { [key: string]: {
    count: number;
    total: number;
    deposits: number;
    withdrawals: number;
  }} {
    const monthly: { [key: string]: any } = {};
    
    table.transactions.forEach(transaction => {
      const date = this.parseDate(transaction.date);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      
      if (!monthly[monthKey]) {
        monthly[monthKey] = { count: 0, total: 0, deposits: 0, withdrawals: 0 };
      }
      
      monthly[monthKey].count++;
      monthly[monthKey].total += transaction.amount;
      
      if (transaction.amount > 0) {
        monthly[monthKey].deposits += transaction.amount;
      } else {
        monthly[monthKey].withdrawals += Math.abs(transaction.amount);
      }
    });
    
    return monthly;
  }

  /**
   * Export banking data to a formatted CSV
   */
  exportBankingData(table: BankingCSVTable): string {
    const headers = ['TransactionID', 'From', 'Routing', 'Reason', 'Amount', 'Balance', 'Date'];
    const rows = table.transactions.map(t => [
      t.transactionId,
      t.from,
      t.routing,
      t.reason,
      this.formatAmount(t.amount),
      t.balance,
      t.date
    ]);
    
    const headerLine = headers.map(h => `"${h}"`).join(',');
    const dataLines = rows.map(row => 
      row.map(cell => `"${cell}"`).join(',')
    );
    
    return [headerLine, ...dataLines].join('\n');
  }

  /**
   * Format amount for display
   */
  private formatAmount(amount: number): string {
    const sign = amount >= 0 ? '+' : '';
    return `${sign}$${Math.abs(amount).toLocaleString()}`;
  }
}

// Banking-specific utility functions
export const bankingUtils = {
  /**
   * Load and parse a banking CSV file
   */
  async parseBankingFile(file: File): Promise<BankingCSVTable> {
    const content = await file.text();
    const parser = new BankingCSVParser();
    return parser.parseBankingData(content);
  },

  /**
   * Load and parse a banking CSV from URL
   */
  async parseBankingFromURL(url: string): Promise<BankingCSVTable> {
    const response = await fetch(url);
    const content = await response.text();
    const parser = new BankingCSVParser();
    return parser.parseBankingData(content);
  },

  /**
   * Validate if content looks like banking CSV data
   */
  isValidBankingCSV(content: string): boolean {
    const lines = content.split('\n').filter(line => line.trim() !== '');
    if (lines.length < 2) return false;
    
    const firstLine = lines[0];
    const expectedHeaders = ['', 'From', 'Routing', 'Reason', 'Amount', 'Balance', 'Date'];
    
    // Check if headers match expected banking format
    const headers = firstLine.split(',').map(h => h.replace(/"/g, '').trim());
    if (headers.length !== expectedHeaders.length) return false;
    
    // Check for key banking headers
    const hasFrom = headers.some(h => h.toLowerCase().includes('from'));
    const hasAmount = headers.some(h => h.toLowerCase().includes('amount'));
    const hasDate = headers.some(h => h.toLowerCase().includes('date'));
    
    return hasFrom && hasAmount && hasDate;
  }
};
