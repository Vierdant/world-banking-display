export interface CSVRow {
  [key: string]: string;
}

export interface CSVTable {
  headers: string[];
  rows: CSVRow[];
  totalRows: number;
}

export interface CSVParseOptions {
  skipEmptyRows?: boolean;
  trimWhitespace?: boolean;
  handleEmptyHeaders?: boolean;
}

export class CSVParser {
  private options: CSVParseOptions;

  constructor(options: CSVParseOptions = {}) {
    this.options = {
      skipEmptyRows: true,
      trimWhitespace: true,
      handleEmptyHeaders: true,
      ...options
    };
  }

  /**
   * Parse CSV content from a string
   */
  parse(csvContent: string): CSVTable {
    const lines = csvContent.split('\n').filter(line => line.trim() !== '');
    
    if (lines.length === 0) {
      return { headers: [], rows: [], totalRows: 0 };
    }

    // Parse headers
    const headers = this.parseCSVLine(lines[0]);
    
    // Handle empty headers by generating meaningful names
    const processedHeaders = this.processHeaders(headers);
    
    // Parse data rows
    const rows: CSVRow[] = [];
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line === '' && this.options.skipEmptyRows) continue;
      
      const values = this.parseCSVLine(line);
      if (values.length === 0) continue;
      
      const row: CSVRow = {};
      processedHeaders.forEach((header, index) => {
        if (index < values.length) {
          let value = values[index];
          if (this.options.trimWhitespace) {
            value = value.trim();
          }
          row[header] = value;
        } else {
          row[header] = '';
        }
      });
      
      rows.push(row);
    }

    return {
      headers: processedHeaders,
      rows,
      totalRows: rows.length
    };
  }

  /**
   * Parse a single CSV line, handling quoted values properly
   */
  private parseCSVLine(line: string): string[] {
    const values: string[] = [];
    let current = '';
    let inQuotes = false;
    let i = 0;

    while (i < line.length) {
      const char = line[i];
      
      if (char === '"') {
        if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
          // Handle escaped quotes
          current += '"';
          i += 2;
        } else {
          // Toggle quote state
          inQuotes = !inQuotes;
          i++;
        }
      } else if (char === ',' && !inQuotes) {
        // End of field
        values.push(current);
        current = '';
        i++;
      } else {
        current += char;
        i++;
      }
    }
    
    // Add the last field
    values.push(current);
    
    return values;
  }

  /**
   * Process headers to handle empty ones and generate meaningful names
   */
  private processHeaders(headers: string[]): string[] {
    return headers.map((header, index) => {
      let processedHeader = header.trim();
      
      if (processedHeader === '' && this.options.handleEmptyHeaders) {
        // Generate meaningful names for empty headers
        switch (index) {
          case 0:
            processedHeader = 'TransactionID';
            break;
          default:
            processedHeader = `Column${index + 1}`;
        }
      }
      
      return processedHeader;
    });
  }

  /**
   * Get a specific column by header name
   */
  getColumn(table: CSVTable, headerName: string): string[] {
    return table.rows.map(row => row[headerName] || '');
  }

  /**
   * Filter rows based on a condition
   */
  filterRows(table: CSVTable, predicate: (row: CSVRow) => boolean): CSVRow[] {
    return table.rows.filter(predicate);
  }

  /**
   * Sort rows by a specific column
   */
  sortRows(table: CSVTable, headerName: string, ascending: boolean = true): CSVRow[] {
    const sortedRows = [...table.rows].sort((a, b) => {
      const aVal = a[headerName] || '';
      const bVal = b[headerName] || '';
      
      if (ascending) {
        return aVal.localeCompare(bVal);
      } else {
        return bVal.localeCompare(aVal);
      }
    });
    
    return sortedRows;
  }

  /**
   * Get unique values from a specific column
   */
  getUniqueValues(table: CSVTable, headerName: string): string[] {
    const values = this.getColumn(table, headerName);
    return [...new Set(values.filter(val => val !== ''))];
  }

  /**
   * Search rows by text in any column
   */
  searchRows(table: CSVTable, searchTerm: string): CSVRow[] {
    const term = searchTerm.toLowerCase();
    return table.rows.filter(row => 
      Object.values(row).some(value => 
        value.toLowerCase().includes(term)
      )
    );
  }

  /**
   * Get summary statistics for numeric columns
   */
  getColumnStats(table: CSVTable, headerName: string) {
    const values = this.getColumn(table, headerName);
    const numericValues = values
      .map(val => this.parseAmount(val))
      .filter(num => !isNaN(num));
    
    if (numericValues.length === 0) {
      return { count: 0, sum: 0, average: 0, min: 0, max: 0 };
    }
    
    const sum = numericValues.reduce((acc, val) => acc + val, 0);
    const average = sum / numericValues.length;
    const min = Math.min(...numericValues);
    const max = Math.max(...numericValues);
    
    return {
      count: numericValues.length,
      sum,
      average,
      min,
      max
    };
  }

  /**
   * Parse amount strings like "+$500", "-$2,500" to numbers
   */
  protected parseAmount(amountStr: string): number {
    // Remove currency symbols, commas, and spaces
    const cleanStr = amountStr.replace(/[$,+\s]/g, '');
    
    // Check if it's negative (starts with -)
    const isNegative = cleanStr.startsWith('-');
    const numericPart = cleanStr.replace(/^-/, '');
    
    const num = parseFloat(numericPart);
    return isNaN(num) ? NaN : (isNegative ? -num : num);
  }

  /**
   * Export table back to CSV format
   */
  exportToCSV(table: CSVTable): string {
    const headerLine = table.headers.map(header => `"${header}"`).join(',');
    const dataLines = table.rows.map(row => 
      table.headers.map(header => `"${row[header] || ''}"`).join(',')
    );
    
    return [headerLine, ...dataLines].join('\n');
  }
}

// Utility functions for common operations
export const csvUtils = {
  /**
   * Load and parse a CSV file from a File object
   */
  async parseFile(file: File, options?: CSVParseOptions): Promise<CSVTable> {
    const content = await file.text();
    const parser = new CSVParser(options);
    return parser.parse(content);
  },

  /**
   * Load and parse a CSV file from a URL
   */
  async parseFromURL(url: string, options?: CSVParseOptions): Promise<CSVTable> {
    const response = await fetch(url);
    const content = await response.text();
    const parser = new CSVParser(options);
    return parser.parse(content);
  },

  /**
   * Validate if a string looks like CSV content
   */
  isValidCSV(content: string): boolean {
    const lines = content.split('\n');
    if (lines.length < 2) return false;
    
    const firstLine = lines[0];
    const commaCount = (firstLine.match(/,/g) || []).length;
    
    // Check if subsequent lines have similar comma counts
    for (let i = 1; i < Math.min(lines.length, 5); i++) {
      const line = lines[i].trim();
      if (line === '') continue;
      
      const lineCommaCount = (line.match(/,/g) || []).length;
      if (Math.abs(lineCommaCount - commaCount) > 1) {
        return false;
      }
    }
    
    return true;
  }
};
