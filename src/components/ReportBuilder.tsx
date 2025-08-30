import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Student, Goal, TrackingEntry, EmotionEntry, SensoryEntry } from "@/types/student";
import { FileText, Download, Printer, Mail, Calendar, TrendingUp, Crosshair } from "lucide-react";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { toast } from "sonner";
import { downloadBlob } from "@/lib/utils";
import { useTranslation } from '@/hooks/useTranslation';

interface ReportBuilderProps {
  student: Student;
  goals: Goal[];
  trackingEntries: TrackingEntry[];
  emotions: EmotionEntry[];
  sensoryInputs: SensoryEntry[];
}

interface ReportTemplate {
  id: string;
  name: string;
  description: string;
  sections: string[];
}

const reportTemplates: ReportTemplate[] = [
  {
    id: 'progress-summary',
    name: 'reports.templates.progress-summary.name',
    description: 'reports.templates.progress-summary.description',
    sections: ['student-info', 'goal-progress', 'recent-activities', 'recommendations']
  },
  {
    id: 'iep-meeting',
    name: 'reports.templates.iep-meeting.name',
    description: 'reports.templates.iep-meeting.description',
    sections: ['student-info', 'goal-progress', 'behavioral-patterns', 'environmental-factors', 'recommendations', 'next-steps']
  },
  {
    id: 'behavioral-analysis',
    name: 'reports.templates.behavioral-analysis.name',
    description: 'reports.templates.behavioral-analysis.description',
    sections: ['student-info', 'behavioral-patterns', 'sensory-patterns', 'environmental-factors', 'interventions']
  },
  {
    id: 'quarterly-review',
    name: 'reports.templates.quarterly-review.name',
    description: 'reports.templates.quarterly-review.description',
    sections: ['student-info', 'goal-progress', 'data-trends', 'achievements', 'challenges', 'next-quarter-planning']
  }
];

export const ReportBuilder = ({ student, goals, trackingEntries, emotions, sensoryInputs }: ReportBuilderProps) => {
  const { tCommon } = useTranslation();
  const [showBuilder, setShowBuilder] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('progress-summary');
  const [reportData, setReportData] = useState({
    title: '',
    dateRange: {
      start: format(startOfMonth(subMonths(new Date(), 1)), 'yyyy-MM-dd'),
      end: format(endOfMonth(new Date()), 'yyyy-MM-dd')
    },
    sections: [] as string[],
    includeCharts: true,
    includeRawData: false,
    customNotes: '',
    reportingTeacher: '',
    schoolDistrict: ''
  });
  const printRef = useRef<HTMLDivElement>(null);

  const handleTemplateChange = (templateId: string) => {
    const template = reportTemplates.find(t => t.id === templateId);
    if (template) {
      setSelectedTemplate(templateId);
      setReportData(prev => ({
        ...prev,
        title: tCommon(template.name as unknown as string),
        sections: template.sections
      }));
    }
  };

  /**
   * Generate comprehensive report data with error handling.
   * Safely processes date ranges and handles edge cases.
   * 
   * @returns {Object} Aggregated report data for rendering
   */
  const generateReportData = () => {
    // Parse dates with validation
    const startDate = new Date(reportData.dateRange.start);
    const endDate = new Date(reportData.dateRange.end);
    
    // Validate date parsing
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      toast.error(tCommon('reports.builder.errors.invalidDateRange'));
      return null;
    }
    
    if (startDate > endDate) {
      toast.error(tCommon('reports.builder.errors.startBeforeEnd'));
      return null;
    }

    // Filter data by date range
    const filteredEntries = trackingEntries.filter(entry => 
      entry.timestamp >= startDate && entry.timestamp <= endDate
    );
    const filteredEmotions = emotions.filter(emotion => 
      emotion.timestamp >= startDate && emotion.timestamp <= endDate
    );
    const filteredSensory = sensoryInputs.filter(sensory => 
      sensory.timestamp >= startDate && sensory.timestamp <= endDate
    );

    // Calculate progress metrics
    const goalProgress = goals.map(goal => {
      const progressInPeriod = goal.dataPoints.filter(dp => 
        dp.timestamp >= startDate && dp.timestamp <= endDate
      );
      const progressChange = progressInPeriod.length > 1 
        ? progressInPeriod[progressInPeriod.length - 1].value - progressInPeriod[0].value
        : 0;

      return {
        ...goal,
        progressInPeriod: progressInPeriod.length,
        progressChange,
        currentValue: goal.dataPoints.length > 0 ? goal.dataPoints[goal.dataPoints.length - 1].value : 0
      };
    });

    // Emotion patterns
    const emotionSummary = filteredEmotions.reduce((acc, emotion) => {
      acc[emotion.emotion] = (acc[emotion.emotion] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const avgEmotionIntensity = filteredEmotions.length > 0
      ? filteredEmotions.reduce((sum, e) => sum + e.intensity, 0) / filteredEmotions.length
      : 0;

    // Sensory patterns
    const sensorySeekingCount = filteredSensory.filter(s => s.response === 'seeking').length;
    const sensoryAvoidingCount = filteredSensory.filter(s => s.response === 'avoiding').length;

    const sensorySummary = filteredSensory.reduce((acc, sensory) => {
      acc[sensory.sensoryType] = (acc[sensory.sensoryType] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      period: { start: startDate, end: endDate },
      totalSessions: filteredEntries.length,
      goalProgress,
      emotionSummary,
      avgEmotionIntensity,
      sensorySummary,
      sensorySeekingCount,
      sensoryAvoidingCount,
      achievements: goalProgress.filter(g => g.progressChange > 0),
      challenges: goalProgress.filter(g => g.progressChange < 0 || g.currentProgress < 50)
    };
  };

  const generatePDF = () => {
    const reportAnalysis = generateReportData();
    
    // In a real implementation, this would use a PDF library like jsPDF or Puppeteer
    // For now, we'll create a printable HTML version
    
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>${reportData.title} - ${student.name}</title>
          <style>
            body { 
              font-family: Arial, sans-serif; 
              margin: 40px; 
              line-height: 1.6;
              color: #333;
            }
            .header { 
              text-align: center; 
              border-bottom: 2px solid #4f46e5; 
              padding-bottom: 20px; 
              margin-bottom: 30px;
            }
            .section { 
              margin-bottom: 30px; 
              page-break-inside: avoid;
            }
            .section h2 { 
              color: #4f46e5; 
              border-bottom: 1px solid #e5e7eb; 
              padding-bottom: 10px;
            }
            .goal-card {
              border: 1px solid #e5e7eb;
              border-radius: 8px;
              padding: 15px;
              margin-bottom: 15px;
              background: #f9fafb;
            }
            .progress-bar {
              background: #e5e7eb;
              height: 10px;
              border-radius: 5px;
              overflow: hidden;
              margin: 10px 0;
            }
            .progress-fill {
              background: #4f46e5;
              height: 100%;
              transition: width 0.3s ease;
            }
            .metric {
              display: inline-block;
              margin: 10px 15px 10px 0;
              padding: 10px;
              background: #f3f4f6;
              border-radius: 6px;
              min-width: 120px;
              text-align: center;
            }
            .metric-value {
              font-size: 24px;
              font-weight: bold;
              color: #4f46e5;
            }
            .metric-label {
              font-size: 12px;
              color: #6b7280;
              text-transform: uppercase;
            }
            @media print {
              body { margin: 20px; }
              .section { page-break-inside: avoid; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>${reportData.title}</h1>
            <h2>${student.name}</h2>
            <p>Report Period: ${format(reportAnalysis.period.start, 'MMMM dd, yyyy')} - ${format(reportAnalysis.period.end, 'MMMM dd, yyyy')}</p>
            <p>Generated: ${format(new Date(), 'MMMM dd, yyyy')}</p>
            ${reportData.reportingTeacher ? `<p>Prepared by: ${reportData.reportingTeacher}</p>` : ''}
            ${reportData.schoolDistrict ? `<p>School District: ${reportData.schoolDistrict}</p>` : ''}
          </div>

          ${reportData.sections.includes('student-info') ? `
            <div class="section">
              <h2>Student Information</h2>
              <p><strong>Name:</strong> ${student.name}</p>
              ${student.grade ? `<p><strong>Grade:</strong> ${student.grade}</p>` : ''}
              ${student.dateOfBirth ? `<p><strong>Date of Birth:</strong> ${student.dateOfBirth}</p>` : ''}
              <p><strong>Program Start Date:</strong> ${format(student.createdAt, 'MMMM dd, yyyy')}</p>
              ${student.notes ? `<p><strong>Notes:</strong> ${student.notes}</p>` : ''}
            </div>
          ` : ''}

          ${reportData.sections.includes('goal-progress') ? `
            <div class="section">
              <h2>IEP Goal Progress</h2>
              ${reportAnalysis.goalProgress.map(goal => `
                <div class="goal-card">
                  <h3>${goal.title}</h3>
                  <p><strong>Category:</strong> ${goal.category}</p>
                  <p><strong>Target Date:</strong> ${format(goal.targetDate, 'MMMM dd, yyyy')}</p>
                  <p><strong>Current Progress:</strong> ${Math.round(goal.currentProgress)}%</p>
                  <div class="progress-bar">
                    <div class="progress-fill" style="width: ${goal.currentProgress}%"></div>
                  </div>
                  <p><strong>Measurable Objective:</strong> ${goal.measurableObjective}</p>
                  ${goal.progressInPeriod > 0 ? `<p><strong>Data Points in Period:</strong> ${goal.progressInPeriod}</p>` : ''}
                  ${goal.progressChange !== 0 ? `<p><strong>Change in Period:</strong> ${goal.progressChange > 0 ? '+' : ''}${goal.progressChange.toFixed(1)}</p>` : ''}
                </div>
              `).join('')}
            </div>
          ` : ''}

          ${reportData.sections.includes('behavioral-patterns') ? `
            <div class="section">
              <h2>Emotional and Behavioral Patterns</h2>
              <div class="metric">
                <div class="metric-value">${reportAnalysis.totalSessions}</div>
                <div class="metric-label">Total Sessions</div>
              </div>
              <div class="metric">
                <div class="metric-value">${reportAnalysis.avgEmotionIntensity.toFixed(1)}</div>
                <div class="metric-label">Avg Intensity</div>
              </div>
              
              <h3>Emotion Distribution</h3>
              ${Object.entries(reportAnalysis.emotionSummary).map(([emotion, count]) => `
                <p><strong>${emotion.charAt(0).toUpperCase() + emotion.slice(1)}:</strong> ${count} occurrences</p>
              `).join('')}
            </div>
          ` : ''}

          ${reportData.sections.includes('sensory-patterns') ? `
            <div class="section">
              <h2>Sensory Processing Patterns</h2>
              <div class="metric">
                <div class="metric-value">${reportAnalysis.sensorySeekingCount}</div>
                <div class="metric-label">Seeking Behaviors</div>
              </div>
              <div class="metric">
                <div class="metric-value">${reportAnalysis.sensoryAvoidingCount}</div>
                <div class="metric-label">Avoiding Behaviors</div>
              </div>
              
              <h3>Sensory Type Distribution</h3>
              ${Object.entries(reportAnalysis.sensorySummary).map(([type, count]) => `
                <p><strong>${type.charAt(0).toUpperCase() + type.slice(1)}:</strong> ${count} entries</p>
              `).join('')}
            </div>
          ` : ''}

          ${reportData.sections.includes('achievements') ? `
            <div class="section">
              <h2>Achievements and Progress</h2>
              ${reportAnalysis.achievements.length > 0 ? 
                reportAnalysis.achievements.map(goal => `
                  <div class="goal-card">
                    <h4>${goal.title}</h4>
                    <p>Progress improved by ${goal.progressChange.toFixed(1)} points</p>
                    <p>Current: ${Math.round(goal.currentProgress)}% complete</p>
                  </div>
                `).join('') : 
                '<p>No significant progress improvements detected in this period.</p>'
              }
            </div>
          ` : ''}

          ${reportData.sections.includes('challenges') ? `
            <div class="section">
              <h2>Areas Needing Attention</h2>
              ${reportAnalysis.challenges.length > 0 ? 
                reportAnalysis.challenges.map(goal => `
                  <div class="goal-card">
                    <h4>${goal.title}</h4>
                    <p>Current Progress: ${Math.round(goal.currentProgress)}%</p>
                    ${goal.progressChange < 0 ? `<p>⚠️ Progress declined by ${Math.abs(goal.progressChange).toFixed(1)} points</p>` : ''}
                    ${goal.currentProgress < 50 ? '<p>📈 Consider intensifying interventions</p>' : ''}
                  </div>
                `).join('') : 
                '<p>No significant challenges identified in this period.</p>'
              }
            </div>
          ` : ''}

          ${reportData.sections.includes('recommendations') ? `
            <div class="section">
              <h2>Recommendations</h2>
              <ul>
                ${reportAnalysis.challenges.length > 0 ? 
                  '<li>Consider reviewing and adjusting intervention strategies for goals showing limited progress</li>' : ''
                }
                ${reportAnalysis.avgEmotionIntensity > 3.5 ? 
                  '<li>High emotional intensity noted - consider additional calming strategies</li>' : ''
                }
                ${reportAnalysis.sensoryAvoidingCount > reportAnalysis.sensorySeekingCount ? 
                  '<li>Student shows more sensory avoiding behaviors - review environmental accommodations</li>' : ''
                }
                ${reportAnalysis.totalSessions < 8 ? 
                  '<li>Consider increasing data collection frequency for better trend analysis</li>' : ''
                }
                <li>Continue current successful strategies and interventions</li>
                <li>Regular team meetings to discuss progress and adjust goals as needed</li>
              </ul>
            </div>
          ` : ''}

          ${reportData.customNotes ? `
            <div class="section">
              <h2>Additional Notes</h2>
              <p>${reportData.customNotes.replace(/\n/g, '<br>')}</p>
            </div>
          ` : ''}

          <div class="section">
            <h2>Data Collection Summary</h2>
            <p>This report is based on ${reportAnalysis.totalSessions} tracking sessions, ${emotions.length} emotional observations, and ${sensoryInputs.length} sensory input recordings collected from ${format(reportAnalysis.period.start, 'MMMM dd, yyyy')} to ${format(reportAnalysis.period.end, 'MMMM dd, yyyy')}.</p>
          </div>
        </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
    printWindow.focus();
    
    // Auto-print after a brief delay to allow rendering
    setTimeout(() => {
      printWindow.print();
    }, 1000);

    toast.success(tCommon('reports.builder.toast.reportGenerated'));
  };

  const exportCSV = () => {
    const reportAnalysis = generateReportData();
    
    // Create CSV content
    const csvContent = [
      // Headers
      ['Report Type', 'Student Name', 'Period Start', 'Period End', 'Total Sessions', 'Goals Count'],
      // Data
      [
        reportData.title,
        student.name,
        format(reportAnalysis.period.start, 'yyyy-MM-dd'),
        format(reportAnalysis.period.end, 'yyyy-MM-dd'),
        reportAnalysis.totalSessions.toString(),
        goals.length.toString()
      ],
      [],
      ['Goal Progress'],
      ['Goal Title', 'Category', 'Current Progress (%)', 'Target Date', 'Status'],
      ...reportAnalysis.goalProgress.map(goal => [
        goal.title,
        goal.category,
        Math.round(goal.currentProgress).toString(),
        format(goal.targetDate, 'yyyy-MM-dd'),
        goal.status
      ]),
      [],
      ['Emotion Summary'],
      ['Emotion', 'Count'],
      ...Object.entries(reportAnalysis.emotionSummary),
      [],
      ['Sensory Summary'],
      ['Sensory Type', 'Count'],
      ...Object.entries(reportAnalysis.sensorySummary)
    ];

    const csvString = csvContent.map(row => 
      row.map(cell => `"${cell}"`).join(',')
    ).join('\n');

    // Download CSV
    const blob = new Blob([csvString], { type: 'text/csv' });
    downloadBlob(blob, `${student.name.replace(/\s+/g, '_')}_${reportData.title.replace(/\s+/g, '_')}_${format(new Date(), 'yyyy-MM-dd')}.csv`);

    toast.success(tCommon('reports.builder.toast.csvExported'));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">{tCommon('reports.builder.title')}</h3>
          <p className="text-muted-foreground">{tCommon('reports.builder.description')}</p>
        </div>
        <Dialog open={showBuilder} onOpenChange={setShowBuilder}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-primary hover:opacity-90 font-dyslexia">
              <FileText className="h-4 w-4 mr-2" />
              Create Report
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{tCommon('reports.builder.title')}</DialogTitle>
              <DialogDescription>
                {String(tCommon('reports.builder.description'))}
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-6">
              {/* Template Selection */}
              <div>
                <Label>{tCommon('reports.builder.form.reportTemplate')}</Label>
                <Select value={selectedTemplate} onValueChange={handleTemplateChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {reportTemplates.map(template => (
                      <SelectItem key={template.id} value={template.id}>
                        {tCommon(template.name as unknown as string)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground mt-1">
                  {tCommon((reportTemplates.find(t => t.id === selectedTemplate)?.description || '') as unknown as string)}
                </p>
              </div>

              {/* Report Configuration */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="reportTitle">{tCommon('reports.builder.form.reportTitle')}</Label>
                  <Input
                    id="reportTitle"
                    value={reportData.title}
                    onChange={(e) => setReportData(prev => ({ ...prev, title: e.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="teacher">{tCommon('reports.builder.form.reportingTeacher')}</Label>
                  <Input
                    id="teacher"
                    value={reportData.reportingTeacher}
                    onChange={(e) => setReportData(prev => ({ ...prev, reportingTeacher: e.target.value }))}
                    placeholder={tCommon('reports.builder.form.reportingTeacherPlaceholder')}
                  />
                </div>
              </div>

              {/* Date Range */}
              <div>
                <Label>{tCommon('reports.builder.form.reportPeriod')}</Label>
                <div className="grid grid-cols-2 gap-4 mt-1">
                  <div>
                    <Label htmlFor="startDate" className="text-sm">{tCommon('reports.builder.form.startDate')}</Label>
                    <Input
                      id="startDate"
                      type="date"
                      value={reportData.dateRange.start}
                      onChange={(e) => setReportData(prev => ({
                        ...prev,
                        dateRange: { ...prev.dateRange, start: e.target.value }
                      }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="endDate" className="text-sm">{tCommon('reports.builder.form.endDate')}</Label>
                    <Input
                      id="endDate"
                      type="date"
                      value={reportData.dateRange.end}
                      onChange={(e) => setReportData(prev => ({
                        ...prev,
                        dateRange: { ...prev.dateRange, end: e.target.value }
                      }))}
                    />
                  </div>
                </div>
              </div>

              {/* Sections */}
              <div>
                <Label>{tCommon('reports.builder.form.reportSections')}</Label>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  {[
                    'student-info',
                    'goal-progress',
                    'behavioral-patterns',
                    'sensory-patterns',
                    'environmental-factors',
                    'achievements',
                    'challenges',
                    'recommendations',
                    'next-steps',
                    'interventions'
                  ].map(id => ({ id, label: tCommon(`reports.builder.sections.${id}`) })).map(section => (
                    <div key={section.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={section.id}
                        checked={reportData.sections.includes(section.id)}
                        onCheckedChange={(checked) => {
                          setReportData(prev => ({
                            ...prev,
                            sections: checked 
                              ? [...prev.sections, section.id]
                              : prev.sections.filter(s => s !== section.id)
                          }));
                        }}
                      />
                      <Label htmlFor={section.id} className="text-sm">{section.label}</Label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Options */}
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="includeCharts"
                    checked={reportData.includeCharts}
                    onCheckedChange={(checked) => setReportData(prev => ({ ...prev, includeCharts: !!checked }))}
                  />
                  <Label htmlFor="includeCharts">{tCommon('reports.builder.form.includeCharts')}</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="includeRawData"
                    checked={reportData.includeRawData}
                    onCheckedChange={(checked) => setReportData(prev => ({ ...prev, includeRawData: !!checked }))}
                  />
                  <Label htmlFor="includeRawData">{tCommon('reports.builder.form.includeRawData')}</Label>
                </div>
              </div>

              {/* Custom Notes */}
              <div>
                <Label htmlFor="customNotes">{tCommon('reports.builder.form.additionalNotes')}</Label>
                <Textarea
                  id="customNotes"
                  value={reportData.customNotes}
                  onChange={(e) => setReportData(prev => ({ ...prev, customNotes: e.target.value }))}
                  placeholder={tCommon('reports.builder.form.additionalNotesPlaceholder')}
                  rows={3}
                />
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={exportCSV}>
                  <Download className="h-4 w-4 mr-2" />
                  {tCommon('reports.builder.form.exportCsv')}
                </Button>
                <Button onClick={generatePDF}>
                  <Printer className="h-4 w-4 mr-2" />
                  {tCommon('reports.builder.form.generatePdf')}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Quick Reports */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {reportTemplates.map(template => (
          <Card key={template.id} className="bg-gradient-card border-0 shadow-soft cursor-pointer hover:shadow-lg transition-shadow"
                onClick={() => {
                  handleTemplateChange(template.id);
                  setShowBuilder(true);
                }}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">{tCommon(template.name as unknown as string)}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground mb-3">{tCommon(template.description as unknown as string)}</p>
              <Badge variant="outline" className="text-xs">
                {tCommon('reports.sectionsCount', { count: template.sections.length })}
              </Badge>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};