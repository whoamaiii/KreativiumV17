import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Student, TrackingEntry, EmotionEntry, SensoryEntry } from '@/types/student';
import { TrendingUp, AlertTriangle, Target, Lightbulb } from 'lucide-react';

type AnalysisBundle = {
  patterns?: Array<{ pattern?: string; description?: string; confidence?: number; type?: string; dataPoints?: number }>;
  predictiveInsights?: Array<{ title?: string; description?: string; confidence?: number; timeframe?: string }>;
  anomalies?: Array<{ description: string; timestamp: Date; severity: 'low'|'medium'|'high' }>;
  correlationMatrix?: { significantPairs?: Array<{ factor1: string; factor2: string; correlation: number; significance: string }> } | null;
  isAnalyzing?: boolean;
};

interface Props {
  student: Student;
  filteredData: {
    entries: TrackingEntry[];
    emotions: EmotionEntry[];
    sensoryInputs: SensoryEntry[];
  };
  analysis: AnalysisBundle;
  activePreset?: string | null;
  onCreateGoal?: () => void;
  onAddIntervention?: () => void;
  onScheduleBreak?: () => void;
  onJumpToTracking?: () => void;
  className?: string;
}

const scoreToBadge = (p?: number) => {
  if (!p && p !== 0) return <Badge variant="outline">n/a</Badge>;
  const pct = Math.round(p * 100);
  const variant = p >= 0.7 ? 'default' : p >= 0.4 ? 'secondary' : 'destructive';
  return <Badge variant={variant}>{pct}%</Badge>;
};

export const TeacherInsightsPanel: React.FC<Props> = ({
  student,
  filteredData,
  analysis,
  activePreset,
  onCreateGoal,
  onAddIntervention,
  onScheduleBreak,
  onJumpToTracking,
  className = ''
}) => {
  const sessions = filteredData?.entries?.length ?? 0;
  const emotions = filteredData?.emotions?.length ?? 0;

  const limited = sessions < 10 || new Set(filteredData.entries.map(e => e.timestamp.toDateString())).size < 7;
  const pairs = analysis.correlationMatrix?.significantPairs || [];
  const topCorr = pairs[0];
  const topPattern = (analysis.patterns || []).sort((a,b) => (b.confidence ?? 0) - (a.confidence ?? 0))[0];
  const anomaly = (analysis.anomalies || [])[0];

  return (
    <Card className={`w-full md:w-[360px] lg:w-[400px] bg-card/60 border border-border/60 ${className}`}>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Lightbulb className="h-5 w-5" />
          Insights for {student.name}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">

        {activePreset && (
          <div className="text-sm text-muted-foreground">
            You’re viewing: <span className="font-medium">{activePreset.replaceAll('_',' ')}</span>
          </div>
        )}

        {limited && (
          <div className="p-3 rounded-lg bg-muted/40 text-sm">
            Limited data — results may change as more sessions are recorded. Try tracking for at least 7 days and 10 sessions for stronger findings.
          </div>
        )}

        {topPattern && (
          <div className="p-3 rounded-lg border">
            <div className="flex items-center justify-between">
              <div className="font-medium flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Pattern detected
              </div>
              {scoreToBadge(topPattern.confidence)}
            </div>
            <div className="text-sm mt-1">{topPattern.description || topPattern.pattern}</div>
          </div>
        )}

        {topCorr && (
          <div className="p-3 rounded-lg border">
            <div className="font-medium">Correlation</div>
            <div className="text-sm mt-1">{topCorr.factor1} ↔ {topCorr.factor2}</div>
            <div className="text-xs text-muted-foreground">r = {topCorr.correlation.toFixed(2)} ({topCorr.significance})</div>
          </div>
        )}

        {anomaly && (
          <div className="p-3 rounded-lg border">
            <div className="flex items-center gap-2 font-medium">
              <AlertTriangle className="h-4 w-4 text-amber-600" /> Recent Anomaly
            </div>
            <div className="text-sm mt-1">{anomaly.description}</div>
          </div>
        )}

        <div className="pt-2 grid grid-cols-2 gap-2">
          <Button variant="outline" size="sm" onClick={onCreateGoal}><Target className="h-4 w-4 mr-1" />Create Goal</Button>
          <Button variant="outline" size="sm" onClick={onAddIntervention}>Add Intervention</Button>
          <Button variant="outline" size="sm" onClick={onScheduleBreak}>Schedule Break</Button>
          <Button variant="outline" size="sm" onClick={onJumpToTracking}>Track Now</Button>
        </div>

        <div className="text-xs text-muted-foreground pt-2">
          Data: {sessions} sessions, {emotions} emotions
        </div>
      </CardContent>
    </Card>
  );
};


