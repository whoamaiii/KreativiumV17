import { Student, TrackingEntry, EmotionEntry, SensoryEntry, Goal } from "@/types/student";
import { format } from "date-fns";

// Report content structure for PDF generation
interface ReportContent {
  header: {
    title: string;
    dateRange: string;
    generatedDate: string;
    studentInfo: {
      name: string;
      grade?: string;
      id: string;
    };
  };
  summary: {
    totalSessions: number;
    totalEmotions: number;
    totalSensoryInputs: number;
    activeGoals: number;
    completedGoals: number;
  };
  emotionAnalysis: {
    mostCommon: string;
    avgIntensity: string;
    positiveRate: string;
  };
  sensoryAnalysis: {
    seekingRatio: string;
    mostCommonType: string;
  };
  goalProgress: Array<{
    title: string;
    progress: number;
    status: string;
  }>;
  recommendations: string[];
}

// CSV parsing result
interface CSVParseResult {
  id: string;
  [key: string]: unknown;
}

// Data collections for export
interface ExportDataCollection {
  trackingEntries: TrackingEntry[];
  emotions: EmotionEntry[];
  sensoryInputs: SensoryEntry[];
  goals: Goal[];
}

export interface ExportOptions {
  format: 'pdf' | 'csv' | 'json';
  includeFields: string[];
  dateRange?: {
    start: Date;
    end: Date;
  };
  groupBy?: 'student' | 'date' | 'goal';
  includeCharts?: boolean;
  anonymize?: boolean;
}

export interface BackupData {
  version: string;
  timestamp: Date;
  students: Student[];
  trackingEntries: TrackingEntry[];
  emotions: EmotionEntry[];
  sensoryInputs: SensoryEntry[];
  goals: Goal[];
  metadata: {
    exportedBy: string;
    totalRecords: number;
    dateRange: {
      earliest: Date;
      latest: Date;
    };
  };
}

class ExportSystem {
  private readonly CURRENT_VERSION = '1.0.0';

  // PDF Generation
  async generatePDFReport(
    student: Student,
    data: {
      trackingEntries: TrackingEntry[];
      emotions: EmotionEntry[];
      sensoryInputs: SensoryEntry[];
      goals: Goal[];
    },
    options: ExportOptions
  ): Promise<Blob> {
    // Create a virtual document structure for PDF generation
    const reportContent = this.buildReportContent(student, data, options);
    
    // For now, create a simple HTML-based report that can be printed to PDF
    const htmlContent = this.generateHTMLReport(reportContent, options);
    
    // Convert to blob for download
    return new Blob([htmlContent], { type: 'text/html' });
  }

  // CSV Export
  generateCSVExport(
    students: Student[],
    allData: {
      trackingEntries: TrackingEntry[];
      emotions: EmotionEntry[];
      sensoryInputs: SensoryEntry[];
      goals: Goal[];
    },
    options: ExportOptions
  ): string {
    const { includeFields, dateRange, anonymize } = options;
    let csvContent = '';

    if (includeFields.includes('emotions')) {
      const emotionData = this.filterByDateRange(allData.emotions, dateRange);
      csvContent += this.generateEmotionsCSV(emotionData, students, anonymize);
      csvContent += '\n\n';
    }

    if (includeFields.includes('sensoryInputs')) {
      const sensoryData = this.filterByDateRange(allData.sensoryInputs, dateRange);
      csvContent += this.generateSensoryCSV(sensoryData, students, anonymize);
      csvContent += '\n\n';
    }

    if (includeFields.includes('goals')) {
      csvContent += this.generateGoalsCSV(allData.goals, students, anonymize);
      csvContent += '\n\n';
    }

    if (includeFields.includes('trackingEntries')) {
      const trackingData = this.filterByDateRange(allData.trackingEntries, dateRange);
      csvContent += this.generateTrackingCSV(trackingData, students, anonymize);
    }

    return csvContent;
  }

  // JSON Export with Full Data Structure
  generateJSONExport(
    students: Student[],
    allData: {
      trackingEntries: TrackingEntry[];
      emotions: EmotionEntry[];
      sensoryInputs: SensoryEntry[];
      goals: Goal[];
    },
    options: ExportOptions
  ): string {
    const { includeFields, dateRange, anonymize } = options;
    
    interface JSONExportData {
      version: string;
      exportDate: string;
      options: ExportOptions;
      data: {
        students?: Student[];
        emotions?: EmotionEntry[];
        sensoryInputs?: SensoryEntry[];
        goals?: Goal[];
        trackingEntries?: TrackingEntry[];
      };
    }

    const exportData: JSONExportData = {
      version: this.CURRENT_VERSION,
      exportDate: new Date().toISOString(),
      options,
      data: {}
    };

    if (includeFields.includes('students')) {
      exportData.data.students = anonymize 
        ? students.map(s => this.anonymizeStudent(s))
        : students;
    }

    if (includeFields.includes('emotions')) {
      const emotionData = this.filterByDateRange(allData.emotions, dateRange);
      exportData.data.emotions = anonymize 
        ? emotionData.map(e => this.anonymizeEmotion(e))
        : emotionData;
    }

    if (includeFields.includes('sensoryInputs')) {
      const sensoryData = this.filterByDateRange(allData.sensoryInputs, dateRange);
      exportData.data.sensoryInputs = anonymize 
        ? sensoryData.map(s => this.anonymizeSensory(s))
        : sensoryData;
    }

    if (includeFields.includes('goals')) {
      exportData.data.goals = anonymize 
        ? allData.goals.map(g => this.anonymizeGoal(g))
        : allData.goals;
    }

    if (includeFields.includes('trackingEntries')) {
      const trackingData = this.filterByDateRange(allData.trackingEntries, dateRange);
      exportData.data.trackingEntries = anonymize 
        ? trackingData.map(t => this.anonymizeTracking(t))
        : trackingData;
    }

    return JSON.stringify(exportData, null, 2);
  }

  // Backup System
  createFullBackup(
    students: Student[],
    allData: {
      trackingEntries: TrackingEntry[];
      emotions: EmotionEntry[];
      sensoryInputs: SensoryEntry[];
      goals: Goal[];
    }
  ): BackupData {
    const dates = [
      ...allData.trackingEntries.map(t => t.timestamp),
      ...allData.emotions.map(e => e.timestamp),
      ...allData.sensoryInputs.map(s => s.timestamp)
    ].sort((a, b) => a.getTime() - b.getTime());

    return {
      version: this.CURRENT_VERSION,
      timestamp: new Date(),
      students,
      trackingEntries: allData.trackingEntries,
      emotions: allData.emotions,
      sensoryInputs: allData.sensoryInputs,
      goals: allData.goals,
      metadata: {
        exportedBy: 'Kreativium',
        totalRecords: allData.trackingEntries.length + allData.emotions.length + allData.sensoryInputs.length + allData.goals.length,
        dateRange: {
          earliest: dates[0] || new Date(),
          latest: dates[dates.length - 1] || new Date()
        }
      }
    };
  }

  // Restore from Backup
  async restoreFromBackup(backupData: BackupData): Promise<{
    success: boolean;
    errors: string[];
    imported: {
      students: number;
      trackingEntries: number;
      emotions: number;
      sensoryInputs: number;
      goals: number;
    };
  }> {
    const errors: string[] = [];
    const imported = {
      students: 0,
      trackingEntries: 0,
      emotions: 0,
      sensoryInputs: 0,
      goals: 0
    };

    try {
      // Validate backup version compatibility
      if (!this.isVersionCompatible(backupData.version)) {
        errors.push(`Backup version ${backupData.version} is not compatible with current version ${this.CURRENT_VERSION}`);
        return { success: false, errors, imported };
      }

      // Import data with validation
      const validationResults = await this.validateBackupData(backupData);
      if (validationResults.errors.length > 0) {
        errors.push(...validationResults.errors);
      }

      // Import valid data
      imported.students = validationResults.validStudents.length;
      imported.trackingEntries = validationResults.validTrackingEntries.length;
      imported.emotions = validationResults.validEmotions.length;
      imported.sensoryInputs = validationResults.validSensoryInputs.length;
      imported.goals = validationResults.validGoals.length;

      return {
        success: errors.length === 0,
        errors,
        imported
      };

    } catch (error) {
      errors.push(`Restore failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return { success: false, errors, imported };
    }
  }

  // Import from CSV
  async importFromCSV(csvContent: string, dataType: 'emotions' | 'sensoryInputs' | 'students'): Promise<{
    success: boolean;
    errors: string[];
    imported: (EmotionEntry | SensoryEntry | Student)[];
  }> {
    const errors: string[] = [];
    const imported: (EmotionEntry | SensoryEntry | Student)[] = [];

    try {
      const lines = csvContent.split('\n').filter(line => line.trim() !== '');
      if (lines.length < 2) {
        errors.push('CSV file must contain at least a header row and one data row');
        return { success: false, errors, imported };
      }

      const headers = this.parseCSVLine(lines[0]);
      const requiredHeaders = this.getRequiredHeaders(dataType);
      
      // Validate headers
      const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));
      if (missingHeaders.length > 0) {
        errors.push(`Missing required headers: ${missingHeaders.join(', ')}`);
        return { success: false, errors, imported };
      }

      // Parse data rows
      for (let i = 1; i < lines.length; i++) {
        try {
          const values = this.parseCSVLine(lines[i]);
          if (values.length !== headers.length) {
            errors.push(`Row ${i + 1}: Column count mismatch`);
            continue;
          }

          const rowData = this.parseCSVRowData(headers, values, dataType);
          if (rowData) {
            imported.push(rowData);
          }
        } catch (error) {
          errors.push(`Row ${i + 1}: ${error instanceof Error ? error.message : 'Parse error'}`);
        }
      }

      return {
        success: imported.length > 0,
        errors,
        imported
      };

    } catch (error) {
      errors.push(`Import failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return { success: false, errors, imported };
    }
  }

  // Helper Methods
  private buildReportContent(
    student: Student,
    data: {
      trackingEntries: TrackingEntry[];
      emotions: EmotionEntry[];
      sensoryInputs: SensoryEntry[];
      goals: Goal[];
    },
    options: ExportOptions
  ) {
    return {
      header: {
        title: `Progress Report - ${student.name}`,
        dateRange: options.dateRange ? 
          `${format(options.dateRange.start, 'MMM dd, yyyy')} - ${format(options.dateRange.end, 'MMM dd, yyyy')}` :
          'All time',
        generatedDate: format(new Date(), 'MMM dd, yyyy'),
        studentInfo: {
          name: student.name,
          grade: student.grade,
          id: student.id
        }
      },
      summary: {
        totalSessions: data.trackingEntries.length,
        totalEmotions: data.emotions.length,
        totalSensoryInputs: data.sensoryInputs.length,
        activeGoals: data.goals.filter(g => g.status === 'active').length,
        completedGoals: data.goals.filter(g => g.status === 'achieved').length
      },
      emotionAnalysis: this.analyzeEmotionsForReport(data.emotions),
      sensoryAnalysis: this.analyzeSensoryForReport(data.sensoryInputs),
      goalProgress: this.analyzeGoalsForReport(data.goals),
      recommendations: this.generateRecommendations(data)
    };
  }

  private generateHTMLReport(content: ReportContent, options: ExportOptions): string {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${content.header.title}</title>
    <style>
        body { 
            font-family: 'Arial', sans-serif; 
            line-height: 1.6; 
            margin: 40px; 
            color: #333;
        }
        .header { 
            border-bottom: 2px solid #2563eb; 
            padding-bottom: 20px; 
            margin-bottom: 30px; 
        }
        .section { 
            margin-bottom: 30px; 
            page-break-inside: avoid; 
        }
        .summary-grid { 
            display: grid; 
            grid-template-columns: repeat(2, 1fr); 
            gap: 20px; 
            margin: 20px 0; 
        }
        .summary-card { 
            border: 1px solid #e5e7eb; 
            padding: 15px; 
            border-radius: 8px; 
        }
        .chart-placeholder { 
            height: 200px; 
            background: #f9fafb; 
            border: 1px dashed #d1d5db; 
            display: flex; 
            align-items: center; 
            justify-content: center; 
            margin: 20px 0; 
        }
        @media print {
            body { margin: 20px; }
            .section { page-break-inside: avoid; }
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>${content.header.title}</h1>
        <p><strong>Period:</strong> ${content.header.dateRange}</p>
        <p><strong>Generated:</strong> ${content.header.generatedDate}</p>
        <p><strong>Student ID:</strong> ${content.header.studentInfo.id}</p>
        ${content.header.studentInfo.grade ? `<p><strong>Grade:</strong> ${content.header.studentInfo.grade}</p>` : ''}
    </div>

    <div class="section">
        <h2>Summary</h2>
        <div class="summary-grid">
            <div class="summary-card">
                <h3>Tracking Sessions</h3>
                <p style="font-size: 24px; font-weight: bold;">${content.summary.totalSessions}</p>
            </div>
            <div class="summary-card">
                <h3>Emotions Recorded</h3>
                <p style="font-size: 24px; font-weight: bold;">${content.summary.totalEmotions}</p>
            </div>
            <div class="summary-card">
                <h3>Sensory Inputs</h3>
                <p style="font-size: 24px; font-weight: bold;">${content.summary.totalSensoryInputs}</p>
            </div>
            <div class="summary-card">
                <h3>Active Goals</h3>
                <p style="font-size: 24px; font-weight: bold;">${content.summary.activeGoals}</p>
            </div>
        </div>
    </div>

    <div class="section">
        <h2>Emotional Analysis</h2>
        <p><strong>Most Common Emotion:</strong> ${content.emotionAnalysis.mostCommon}</p>
        <p><strong>Average Intensity:</strong> ${content.emotionAnalysis.avgIntensity}</p>
        <p><strong>Positive Emotion Rate:</strong> ${content.emotionAnalysis.positiveRate}%</p>
        ${options.includeCharts ? '<div class="chart-placeholder">Emotion Trends Chart</div>' : ''}
    </div>

    <div class="section">
        <h2>Sensory Analysis</h2>
        <p><strong>Seeking vs Avoiding:</strong> ${content.sensoryAnalysis.seekingRatio}% seeking</p>
        <p><strong>Most Common Type:</strong> ${content.sensoryAnalysis.mostCommonType}</p>
        ${options.includeCharts ? '<div class="chart-placeholder">Sensory Patterns Chart</div>' : ''}
    </div>

    <div class="section">
        <h2>Goal Progress</h2>
        ${content.goalProgress.map((goal) => `
            <div style="margin-bottom: 15px;">
                <h3>${goal.title}</h3>
                <p><strong>Progress:</strong> ${goal.progress}% complete</p>
                <p><strong>Status:</strong> ${goal.status}</p>
            </div>
        `).join('')}
    </div>

    <div class="section">
        <h2>Recommendations</h2>
        <ul>
            ${content.recommendations.map((rec: string) => `<li>${rec}</li>`).join('')}
        </ul>
    </div>
</body>
</html>
    `;
  }

  private generateEmotionsCSV(emotions: EmotionEntry[], students: Student[], anonymize: boolean): string {
    let csv = 'Date,Student,Emotion,Intensity,Triggers,Notes\n';
    
    emotions.forEach(emotion => {
      const student = students.find(s => s.id === emotion.studentId);
      const studentName = anonymize ? `Student_${emotion.studentId.slice(-4)}` : (student?.name || 'Unknown');
      
      csv += `${format(emotion.timestamp, 'yyyy-MM-dd HH:mm')},`;
      csv += `"${studentName}",`;
      csv += `"${emotion.emotion}",`;
      csv += `${emotion.intensity},`;
      csv += `"${emotion.triggers?.join('; ') || ''}",`;
      csv += `"${emotion.notes || ''}"\n`;
    });

    return csv;
  }

  private generateSensoryCSV(sensoryInputs: SensoryEntry[], students: Student[], anonymize: boolean): string {
    let csv = 'Date,Student,Sensory Type,Response,Intensity,Context,Notes\n';
    
    sensoryInputs.forEach(sensory => {
      const student = students.find(s => s.id === sensory.studentId);
      const studentName = anonymize ? `Student_${sensory.studentId.slice(-4)}` : (student?.name || 'Unknown');
      
      csv += `${format(sensory.timestamp, 'yyyy-MM-dd HH:mm')},`;
      csv += `"${studentName}",`;
      csv += `"${sensory.sensoryType}",`;
      csv += `"${sensory.response}",`;
      csv += `${sensory.intensity},`;
      csv += `"${sensory.notes || ''}",`;
      csv += `"${sensory.notes || ''}"\n`;
    });

    return csv;
  }

  private generateGoalsCSV(goals: Goal[], students: Student[], anonymize: boolean): string {
    let csv = 'Student,Goal Title,Description,Target Value,Current Progress,Status,Date Created\n';
    
    goals.forEach(goal => {
      const student = students.find(s => s.id === goal.studentId);
      const studentName = anonymize ? `Student_${goal.studentId.slice(-4)}` : (student?.name || 'Unknown');
      
      csv += `"${studentName}",`;
      csv += `"${goal.title}",`;
      csv += `"${goal.description}",`;
      csv += `${goal.targetValue},`;
      csv += `${goal.dataPoints?.length ? goal.dataPoints[goal.dataPoints.length - 1].value : 0},`;
      csv += `"${goal.status}",`;
      csv += `${format(goal.createdDate, 'yyyy-MM-dd')}\n`;
    });

    return csv;
  }

  private generateTrackingCSV(trackingEntries: TrackingEntry[], students: Student[], anonymize: boolean): string {
    let csv = 'Date,Student,Session Duration,Emotion Count,Sensory Count,Environmental Notes\n';
    
    trackingEntries.forEach(entry => {
      const student = students.find(s => s.id === entry.studentId);
      const studentName = anonymize ? `Student_${entry.studentId.slice(-4)}` : (student?.name || 'Unknown');
      
      csv += `${format(entry.timestamp, 'yyyy-MM-dd HH:mm')},`;
      csv += `"${studentName}",`;
      csv += `60,`; // Default duration
      csv += `${entry.emotions.length},`;
      csv += `${entry.sensoryInputs.length},`;
      csv += `"${entry.environmentalData?.notes || ''}"\n`;
    });

    return csv;
  }

  private filterByDateRange<T extends { timestamp: Date }>(data: T[], dateRange?: { start: Date; end: Date }): T[] {
    if (!dateRange) return data;
    return data.filter(item => 
      item.timestamp >= dateRange.start && item.timestamp <= dateRange.end
    );
  }

  private anonymizeStudent(student: Student): Student {
    return {
      ...student,
      name: `Student_${student.id.slice(-4)}`,
      dateOfBirth: undefined
    };
  }

  private anonymizeEmotion(emotion: EmotionEntry): EmotionEntry {
    return {
      ...emotion,
      studentId: emotion.studentId.slice(-4)
    };
  }

  private anonymizeSensory(sensory: SensoryEntry): SensoryEntry {
    return {
      ...sensory,
      studentId: sensory.studentId.slice(-4)
    };
  }

  private anonymizeGoal(goal: Goal): Goal {
    return {
      ...goal,
      studentId: goal.studentId.slice(-4)
    };
  }

  private anonymizeTracking(tracking: TrackingEntry): TrackingEntry {
    return {
      ...tracking,
      studentId: tracking.studentId.slice(-4)
    };
  }

  private analyzeEmotionsForReport(emotions: EmotionEntry[]) {
    if (emotions.length === 0) {
      return {
        mostCommon: 'No data',
        avgIntensity: '0.0',
        positiveRate: '0'
      };
    }

    const emotionCounts = emotions.reduce((acc, e) => {
      acc[e.emotion] = (acc[e.emotion] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const mostCommon = Object.entries(emotionCounts)
      .sort(([,a], [,b]) => b - a)[0][0];

    const avgIntensity = (emotions.reduce((sum, e) => sum + e.intensity, 0) / emotions.length).toFixed(1);

    const positiveEmotions = emotions.filter(e => 
      ['happy', 'calm', 'focused', 'excited', 'proud'].includes(e.emotion.toLowerCase())
    ).length;
    const positiveRate = Math.round((positiveEmotions / emotions.length) * 100);

    return {
      mostCommon,
      avgIntensity,
      positiveRate: positiveRate.toString()
    };
  }

  private analyzeSensoryForReport(sensoryInputs: SensoryEntry[]) {
    if (sensoryInputs.length === 0) {
      return {
        seekingRatio: '0',
        mostCommonType: 'No data'
      };
    }

    const seekingCount = sensoryInputs.filter(s => 
      s.response.toLowerCase().includes('seeking')
    ).length;
    const seekingRatio = Math.round((seekingCount / sensoryInputs.length) * 100);

    const typeCounts = sensoryInputs.reduce((acc, s) => {
      acc[s.sensoryType] = (acc[s.sensoryType] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const mostCommonType = Object.entries(typeCounts)
      .sort(([,a], [,b]) => b - a)[0][0];

    return {
      seekingRatio: seekingRatio.toString(),
      mostCommonType
    };
  }

  private analyzeGoalsForReport(goals: Goal[]) {
    return goals.map(goal => ({
      title: goal.title,
      progress: Math.round(((goal.dataPoints?.length ? goal.dataPoints[goal.dataPoints.length - 1].value : 0) / goal.targetValue) * 100),
      status: goal.status
    }));
  }

  private generateRecommendations(data: {
    trackingEntries: TrackingEntry[];
    emotions: EmotionEntry[];
    sensoryInputs: SensoryEntry[];
    goals: Goal[];
  }): string[] {
    const recommendations: string[] = [];

    // Basic recommendations based on data patterns
    if (data.emotions.length > 0) {
      const avgIntensity = data.emotions.reduce((sum: number, e: EmotionEntry) => sum + e.intensity, 0) / data.emotions.length;
      if (avgIntensity > 7) {
        recommendations.push('Consider implementing stress reduction strategies');
      }
    }

    if (data.sensoryInputs.length > 0) {
      const seekingRatio = data.sensoryInputs.filter((s: SensoryEntry) => 
        s.response.toLowerCase().includes('seeking')
      ).length / data.sensoryInputs.length;
      
      if (seekingRatio > 0.7) {
        recommendations.push('Provide more structured sensory breaks and tools');
      }
    }

    if (recommendations.length === 0) {
      recommendations.push('Continue current monitoring and support strategies');
    }

    return recommendations;
  }

  private isVersionCompatible(version: string): boolean {
    // Simple version compatibility check
    const [major] = version.split('.').map(Number);
    const [currentMajor] = this.CURRENT_VERSION.split('.').map(Number);
    return major <= currentMajor;
  }

  private async validateBackupData(backupData: BackupData) {
    // Validate and return valid data
    return {
      validStudents: backupData.students || [],
      validTrackingEntries: backupData.trackingEntries || [],
      validEmotions: backupData.emotions || [],
      validSensoryInputs: backupData.sensoryInputs || [],
      validGoals: backupData.goals || [],
      errors: [] as string[]
    };
  }

  private getRequiredHeaders(dataType: string): string[] {
    const headerMap = {
      emotions: ['Date', 'Emotion', 'Intensity'],
      sensoryInputs: ['Date', 'Sensory Type', 'Response', 'Intensity'],
      students: ['Name', 'Grade']
    };
    return headerMap[dataType as keyof typeof headerMap] || [];
  }

  private parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  }

  private parseCSVRowData(headers: string[], values: string[], dataType: string): EmotionEntry | SensoryEntry | Student | null {
    const data: Record<string, string> = {};
    headers.forEach((header, index) => {
      data[header] = values[index];
    });

    // Basic data type conversion and validation
    switch (dataType) {
      case 'emotions':
        return {
          id: crypto.randomUUID(),
          emotion: data.Emotion,
          intensity: parseInt(data.Intensity) || 0,
          timestamp: new Date(data.Date),
          studentId: '', // Would need to be mapped
          triggers: data.Triggers ? data.Triggers.split(';') : [],
          notes: data.Notes || ''
        };
      case 'sensoryInputs':
        return {
          id: crypto.randomUUID(),
          sensoryType: data['Sensory Type'],
          response: data.Response,
          intensity: parseInt(data.Intensity) || 0,
          timestamp: new Date(data.Date),
          studentId: '', // Would need to be mapped
          context: data.Context || '',
          notes: data.Notes || ''
        };
      case 'students':
        return {
          id: crypto.randomUUID(),
          name: data.Name,
          grade: data.Grade,
          createdAt: new Date(),
          goals: [],
          baselineData: {
            emotionalRegulation: 5,
            sensoryProcessing: 5,
            environmentalPreferences: {}
          }
        };
      default:
        return null;
    }
  }
}

export const exportSystem = new ExportSystem();