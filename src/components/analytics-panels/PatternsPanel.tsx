import React, { memo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Brain, Eye, BarChart3, Clock, Info, TrendingUp } from 'lucide-react';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { useAnalyticsWorker } from '@/hooks/useAnalyticsWorker';
import { TrackingEntry, EmotionEntry, SensoryEntry } from '@/types/student';
import { PatternResult } from '@/lib/patternAnalysis';
import { generateInsightsStructured } from '@/lib/insights';
import { stableKeyFromPattern } from '@/lib/key';
import { useTranslation } from '@/hooks/useTranslation';
import { hashOfString } from '@/lib/key';

export interface PatternsPanelProps {
  filteredData: {
    entries: TrackingEntry[];
    emotions: EmotionEntry[];
    sensoryInputs: SensoryEntry[];
  };
}

const getPatternIcon = (type: string): React.ReactElement => {
  switch (type) {
    case 'emotion':
      return <Brain className="h-4 w-4" />;
    case 'sensory':
      return <Eye className="h-4 w-4" />;
    case 'environmental':
      return <BarChart3 className="h-4 w-4" />;
    default:
      return <TrendingUp className="h-4 w-4" />;
  }
};

const getConfidenceColor = (confidence: number): string => {
  if (confidence > 0.7) return 'text-green-600';
  if (confidence > 0.4) return 'text-yellow-600';
  return 'text-orange-600';
};

export const PatternsPanel = memo(function PatternsPanel({ filteredData }: PatternsPanelProps): React.ReactElement {
  const { results, isAnalyzing, error, runAnalysis } = useAnalyticsWorker({ precomputeOnIdle: false });
  const { tAnalytics } = useTranslation();

  useEffect(() => {
    runAnalysis(filteredData);
    return () => {
      // ensure worker side effects are cleaned by the hook on unmount
    };
  }, [filteredData, runAnalysis]);

  const patterns: PatternResult[] = results?.patterns || [];
  const structured = generateInsightsStructured(
    {
      patterns: results?.patterns || [],
      correlations: (results as any)?.correlations || [],
      predictiveInsights: (results as any)?.predictiveInsights || [],
    },
    filteredData.emotions,
    filteredData.entries
  );

  return (
    <>
      <Card>
          <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>{String(tAnalytics('insights.patterns'))}</CardTitle>
          <Button variant="outline" onClick={() => runAnalysis(filteredData)} disabled={isAnalyzing}>
            {isAnalyzing ? String(tAnalytics('states.analyzing')) : String(tAnalytics('actions.refreshAnalysis'))}
          </Button>
        </CardHeader>
        <CardContent>
          {isAnalyzing && (
            <div className="text-center py-8 text-muted-foreground">
              <Clock className="h-12 w-12 mx-auto mb-4 motion-safe:animate-spin opacity-50" />
              <p>{String(tAnalytics('states.analyzing'))}</p>
            </div>
          )}
          {!isAnalyzing && error && (
            <div className="text-center py-8 text-destructive">
              <p>{error}</p>
            </div>
          )}
          {!isAnalyzing && !error && patterns.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>{String(tAnalytics('empty.noPatterns'))}</p>
              <p className="text-sm">{String(tAnalytics('insights.noPatterns'))}</p>
            </div>
          )}
          {!isAnalyzing && !error && patterns.length > 0 && (
            <div className="space-y-4">
{patterns.map((pattern: PatternResult) => (
                <Card key={stableKeyFromPattern(pattern)} className="border-l-4 border-l-primary">
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        {getPatternIcon(pattern.type)}
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium text-foreground">
                              {String((pattern as PatternResult & { pattern?: string; name?: string }).pattern ?? (pattern as PatternResult & { pattern?: string; name?: string }).name ?? 'Pattern')
                                .replace('-', ' ')
                                .replace(/\b\w/g, (l: string) => l.toUpperCase())}
                            </h4>
                            <HoverCard openDelay={100} closeDelay={80}>
                              <HoverCardTrigger asChild>
                            <button
                                  aria-label={String(tAnalytics('insights.explainPattern'))}
                                  className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] leading-none text-muted-foreground hover:bg-accent/40"
                                >
                                  <Info className="h-3 w-3" />
                                  {String(tAnalytics('insights.explainPattern'))}
                                </button>
                              </HoverCardTrigger>
                              <HoverCardContent className="w-80 text-sm leading-relaxed">
                                <p className="mb-1 font-medium">{String(tAnalytics('insights.patternExplain.title'))}</p>
                                <p className="text-muted-foreground">
                                  {String((pattern as PatternResult & { description?: string }).description ?? String(tAnalytics('insights.patternExplain.default')))} 
                                </p>
                                <p className="mt-2 text-xs text-muted-foreground/80">
                                  {String(tAnalytics('insights.patternExplain.disclaimer'))}
                                </p>
                              </HoverCardContent>
                            </HoverCard>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">
                            {String((pattern as PatternResult & { description?: string }).description ?? '')}
                          </p>
                          {pattern.recommendations && (
                            <div className="mt-3">
                              <h5 className="text-sm font-medium mb-2">{String(tAnalytics('insights.recommendations'))}</h5>
                              <ul className="text-sm text-muted-foreground space-y-1">
{pattern.recommendations.map((rec) => (
                                  <li key={hashOfString(rec)} className="flex items-start gap-2">
                                    <span className="text-primary">•</span>
                                    <span>{rec}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge variant="outline" className={getConfidenceColor(pattern.confidence)}>
                          {String(tAnalytics('insights.confidencePercent', { percentage: Math.round(pattern.confidence * 100) }))}
                        </Badge>
                        <p className="text-xs text-muted-foreground mt-1">
                          {String(tAnalytics('confidence.calculation.dataPoints'))}: {pattern.dataPoints}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{String(tAnalytics('insights.title'))}</CardTitle>
        </CardHeader>
        <CardContent>
          {isAnalyzing && <p className="text-muted-foreground">{String(tAnalytics('states.analyzing'))}</p>}
          {!isAnalyzing && structured.length === 0 && (
            <p className="text-muted-foreground">{String(tAnalytics('insights.noPatterns'))}</p>
          )}
          {!isAnalyzing && structured.length > 0 && (
            <div className="space-y-3">
              {structured.map((msg, idx) => (
                <div key={idx} className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-sm text-foreground">{String(tAnalytics(msg.key.replace(/^analytics\./, ''), msg.params as any))}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
});
