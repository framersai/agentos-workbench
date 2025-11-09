/**
 * @file apps/agentos-client/src/lib/dataExport.ts
 * @description Data export utilities for JSON, CSV, and other formats
 */

export class DataExport {
  /**
   * Export data as JSON file
   */
  exportJSON(data: unknown, filename: string): void {
    try {
      const jsonStr = JSON.stringify(data, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      this.downloadFile(blob, filename);
    } catch (error) {
      console.error('[DataExport] Failed to export JSON:', error);
      throw error;
    }
  }

  /**
   * Export data as CSV file
   */
  exportCSV(rows: Array<Record<string, unknown>>, filename: string): void {
    try {
      if (!rows || rows.length === 0) {
        throw new Error('No data to export');
      }

      // Get headers from first object
      const headers = Object.keys(rows[0]);
      
      // Build CSV content
      const csvRows = [];
      
      // Add header row
      csvRows.push(headers.map(h => this.escapeCsvValue(h)).join(','));
      
      // Add data rows
      for (const row of rows) {
        const values = headers.map(header => {
          const value = row[header];
          return this.escapeCsvValue(value);
        });
        csvRows.push(values.join(','));
      }
      
      const csvContent = csvRows.join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      this.downloadFile(blob, filename);
    } catch (error) {
      console.error('[DataExport] Failed to export CSV:', error);
      throw error;
    }
  }

  /**
   * Export data as plain text file
   */
  exportText(content: string, filename: string): void {
    try {
      const blob = new Blob([content], { type: 'text/plain;charset=utf-8;' });
      this.downloadFile(blob, filename);
    } catch (error) {
      console.error('[DataExport] Failed to export text:', error);
      throw error;
    }
  }

  /**
   * Export data as Markdown file
   */
  exportMarkdown(content: string, filename: string): void {
    try {
      const blob = new Blob([content], { type: 'text/markdown;charset=utf-8;' });
      this.downloadFile(blob, filename);
    } catch (error) {
      console.error('[DataExport] Failed to export markdown:', error);
      throw error;
    }
  }

  /**
   * Format session data as markdown
   */
  formatSessionAsMarkdown(session: {
    sessionId?: string;
    personaId?: string;
    messages: Array<{ role: string; content: string; timestamp?: string }>;
    telemetry?: Array<Record<string, unknown>>;
  }): string {
    const lines: string[] = [];
    
    lines.push('# AgentOS Session Export');
    lines.push('');
    
    if (session.sessionId) {
      lines.push(`**Session ID:** ${session.sessionId}`);
    }
    
    if (session.personaId) {
      lines.push(`**Persona:** ${session.personaId}`);
    }
    
    lines.push(`**Export Date:** ${new Date().toISOString()}`);
    lines.push('');
    lines.push('---');
    lines.push('');
    lines.push('## Conversation');
    lines.push('');
    
    for (const msg of session.messages) {
      const timestamp = msg.timestamp ? new Date(msg.timestamp).toLocaleString() : '';
      lines.push(`### ${msg.role.toUpperCase()} ${timestamp ? `(${timestamp})` : ''}`);
      lines.push('');
      lines.push(msg.content);
      lines.push('');
    }
    
    if (session.telemetry && session.telemetry.length > 0) {
      lines.push('---');
      lines.push('');
      lines.push('## Telemetry Data');
      lines.push('');
      lines.push('```json');
      lines.push(JSON.stringify(session.telemetry, null, 2));
      lines.push('```');
    }
    
    return lines.join('\n');
  }

  /**
   * Copy text to clipboard
   */
  async copyToClipboard(text: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
    } catch (error) {
      console.error('[DataExport] Failed to copy to clipboard:', error);
      throw error;
    }
  }

  /**
   * Escape CSV value
   */
  private escapeCsvValue(value: unknown): string {
    if (value === null || value === undefined) {
      return '';
    }
    
    const str = String(value);
    
    // Check if escaping is needed
    if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
      // Escape quotes by doubling them
      const escaped = str.replace(/"/g, '""');
      return `"${escaped}"`;
    }
    
    return str;
  }

  /**
   * Trigger file download
   */
  private downloadFile(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}

// Singleton instance
// Create singleton instance
export const dataExport = new DataExport();

// Helper function to export all data types at once
export function exportAllData(data: unknown, format: 'json' | 'csv' | 'markdown' | 'text', filename?: string) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const defaultFilename = filename || `export-${timestamp}`;
  
  switch(format) {
    case 'json':
      dataExport.exportJSON(data, `${defaultFilename}.json`);
      break;
    case 'csv':
      if (Array.isArray(data)) {
        dataExport.exportCSV(data, `${defaultFilename}.csv`);
      } else {
        console.error('CSV export requires array data');
      }
      break;
    case 'markdown':
      dataExport.exportMarkdown(data, `${defaultFilename}.md`);
      break;
    case 'text':
      dataExport.exportText(JSON.stringify(data, null, 2), `${defaultFilename}.txt`);
      break;
    default:
      console.error('Unknown export format:', format);
  }
}
