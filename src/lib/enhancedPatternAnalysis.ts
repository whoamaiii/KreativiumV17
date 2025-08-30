/**
 * Module: enhancedPatternAnalysis
 *
 * Purpose
 * - Hybrid statistical + ML analysis for trends, correlations, anomalies, and predictions
 *
 * Robust Statistics Integration
 * - Uses zScoresMedian (MAD-based) and huberRegression to reduce outlier sensitivity
 * - Prefer robust estimators for heavy-tailed or noisy classroom data
 *
 * Parameterization
 * - All thresholds, windows, and sensitivities are read from analyticsConfig
 *   - enhancedAnalysis.predictionConfidenceThreshold
 *   - timeWindows (rolling calculations)
 *   - patternAnalysis.highIntensityThreshold and related knobs
 * - No hardcoded constants; provide safe defaults when config is unavailable
 *
 * Performance & Safety
 * - Avoid blocking the main thread; yield in UI layers if long operations are needed
 * - Log via logger (no console.* in shipped code)
 */
import { EmotionEntry, SensoryEntry, TrackingEntry, Goal } from "@/types/student";
import { isWithinInterval, subDays, format, differenceInDays } from "date-fns";
import { analyticsConfig } from "@/lib/analyticsConfig";
import { mlModels, EmotionPrediction, SensoryPrediction, BaselineCluster } from "@/lib/mlModels";
import { logger } from '@/lib/logger';
import { pearsonCorrelation, pValueForCorrelation, zScoresMedian, huberRegression } from '@/lib/statistics';

export interface PredictiveInsight {
  type: 'prediction' | 'trend' | 'recommendation' | 'risk';
  title: string;
  description: string;
  confidence: number;
  timeframe: string;
  prediction?: {
    value: number;
    trend: 'increasing' | 'decreasing' | 'stable';
    accuracy: number;
  };
  recommendations: string[];
  severity?: 'low' | 'medium' | 'high';
  source?: 'statistical' | 'ml' | 'hybrid';
  mlPrediction?: EmotionPrediction[] | SensoryPrediction;
}

export interface TrendAnalysis {
  metric: string;
  direction: 'increasing' | 'decreasing' | 'stable';
  rate: number; // change per day
  significance: number; // 0-1
  confidence: number;
  forecast: {
    next7Days: number;
    next30Days: number;
    confidence: number;
  };
}

export interface AnomalyDetection {
  timestamp: Date;
  type: 'emotion' | 'sensory' | 'environmental';
  severity: 'low' | 'medium' | 'high';
  description: string;
  deviationScore: number;
  recommendations: string[];
}

export interface CorrelationMatrix {
  factors: string[];
  matrix: number[][];
  significantPairs: Array<{
    factor1: string;
    factor2: string;
    correlation: number;
    pValue: number;
    significance: 'low' | 'moderate' | 'high';
  }>;
}

class EnhancedPatternAnalysisEngine {
  private mlModelsInitialized: boolean = false;

  constructor() {
    // Initialize ML models
    this.initializeMLModels();
  }

  private async initializeMLModels(): Promise<void> {
    try {
      await mlModels.init();
      this.mlModelsInitialized = true;
    } catch (error) {
      logger.error('Failed to initialize ML models:', error);
      this.mlModelsInitialized = false;
    }
  }

  // Predictive Analytics with ML Integration
  async generatePredictiveInsights(
    emotions: EmotionEntry[],
    sensoryInputs: SensoryEntry[],
    trackingEntries: TrackingEntry[],
    goals: Goal[] = []
  ): Promise<PredictiveInsight[]> {
    // Capture config snapshot once per operation
    const cfgAny: any = analyticsConfig as any;
    const cfg = typeof cfgAny.get === 'function' ? cfgAny.get() : analyticsConfig.getConfig();
    const { enhancedAnalysis, timeWindows, alertSensitivity, analytics, insights: insightsCfg, taxonomy, patternAnalysis } = cfg;

    const collectedInsights: PredictiveInsight[] = [];

    // Statistical emotional well-being prediction
    const emotionTrend = this.analyzeEmotionTrend(emotions);
    if (emotionTrend && emotionTrend.significance >= enhancedAnalysis.predictionConfidenceThreshold) {
      const statisticalInsight: PredictiveInsight = {
        type: 'prediction',
        title: 'Emotional Well-being Forecast (Statistical)',
        description: `Based on current trends, emotional intensity is ${emotionTrend.direction}`,
        confidence: emotionTrend.significance,
        timeframe: '7-day forecast',
        prediction: {
          value: emotionTrend.forecast.next7Days,
          trend: emotionTrend.direction,
          accuracy: emotionTrend.confidence
        },
        recommendations: this.getEmotionTrendRecommendations(emotionTrend),
        severity: this.getTrendSeverity(emotionTrend),
        source: 'statistical'
      };
      collectedInsights.push(statisticalInsight);
    }

    // ML emotional prediction if available
    if (this.mlModelsInitialized && trackingEntries.length >= 7) {
      try {
        const modelStatus = await mlModels.getModelStatus();
        if (modelStatus.get('emotion-prediction')) {
          const mlEmotionPredictions = await mlModels.predictEmotions(
            trackingEntries.slice(-14), // Use last 14 days for better context
            7
          );

          if (mlEmotionPredictions.length > 0) {
            // Calculate overall trend from ML predictions
            const avgPredictedIntensity = mlEmotionPredictions.reduce((sum, pred) => {
              const emotionSum = Object.values(pred.emotions).reduce((s, v) => s + v, 0);
              return sum + emotionSum / Object.keys(pred.emotions).length;
            }, 0) / mlEmotionPredictions.length;

            const currentAvgIntensity = emotions.slice(-7).reduce((sum, e) => sum + e.intensity, 0) /
              Math.max(emotions.slice(-7).length, 1);

            const upMultiplier = 1 + enhancedAnalysis.trendThreshold;
            const downMultiplier = 1 - enhancedAnalysis.trendThreshold;
            const mlTrend = avgPredictedIntensity >= currentAvgIntensity * upMultiplier ? 'increasing' :
                           avgPredictedIntensity <= currentAvgIntensity * downMultiplier ? 'decreasing' : 'stable';

            const highT = patternAnalysis.highIntensityThreshold;
            const mediumCut = Math.max(highT - 2, 1);
            const severity: 'low' | 'medium' | 'high' =
              avgPredictedIntensity >= highT ? 'high' :
              avgPredictedIntensity <= mediumCut ? 'medium' : 'low';

            collectedInsights.push({
              type: 'prediction',
              title: 'Emotional Well-being Forecast (ML)',
              description: `Machine learning predicts emotional patterns will be ${mlTrend}`,
              confidence: mlEmotionPredictions[0].confidence,
              timeframe: '7-day forecast',
              prediction: {
                value: avgPredictedIntensity,
                trend: mlTrend,
                accuracy: mlEmotionPredictions[0].confidence
              },
              recommendations: this.getMLEmotionRecommendations(mlEmotionPredictions, mlTrend),
              severity,
              source: 'ml',
              mlPrediction: mlEmotionPredictions
            });
          }
        }
      } catch (error) {
        logger.error('ML emotion prediction failed:', error);
      }
    }

    // Statistical sensory regulation prediction
    const sensoryTrend = this.analyzeSensoryTrend(sensoryInputs);
    if (sensoryTrend && sensoryTrend.significance >= enhancedAnalysis.predictionConfidenceThreshold) {
      collectedInsights.push({
        type: 'prediction',
        title: 'Sensory Regulation Forecast (Statistical)',
        description: `Sensory seeking/avoiding patterns show ${sensoryTrend.direction} trend`,
        confidence: sensoryTrend.significance,
        timeframe: '14-day forecast',
        prediction: {
          value: sensoryTrend.forecast.next7Days,
          trend: sensoryTrend.direction,
          accuracy: sensoryTrend.confidence
        },
        recommendations: this.getSensoryTrendRecommendations(sensoryTrend),
        severity: this.getTrendSeverity(sensoryTrend),
        source: 'statistical'
      });
    }

    // ML sensory prediction if available
    if (this.mlModelsInitialized && trackingEntries.length > 0) {
      try {
        const modelStatus = await mlModels.getModelStatus();
        if (modelStatus.get('sensory-response') && trackingEntries[trackingEntries.length - 1].environmentalData) {
          const latestEnvironment = {
            lighting: trackingEntries[trackingEntries.length - 1].environmentalData?.roomConditions?.lighting as 'bright' | 'dim' | 'moderate' || 'moderate',
            noise: (trackingEntries[trackingEntries.length - 1].environmentalData?.roomConditions?.noiseLevel &&
                   trackingEntries[trackingEntries.length - 1].environmentalData.roomConditions.noiseLevel > 70 ? 'loud' :
                   trackingEntries[trackingEntries.length - 1].environmentalData?.roomConditions?.noiseLevel &&
                   trackingEntries[trackingEntries.length - 1].environmentalData.roomConditions.noiseLevel < 40 ? 'quiet' : 'moderate') as 'loud' | 'moderate' | 'quiet',
            temperature: (trackingEntries[trackingEntries.length - 1].environmentalData?.roomConditions?.temperature &&
                        trackingEntries[trackingEntries.length - 1].environmentalData.roomConditions.temperature > 26 ? 'hot' :
                        trackingEntries[trackingEntries.length - 1].environmentalData?.roomConditions?.temperature &&
                        trackingEntries[trackingEntries.length - 1].environmentalData.roomConditions.temperature < 18 ? 'cold' : 'comfortable') as 'hot' | 'cold' | 'comfortable',
            crowded: 'moderate' as const,
            smells: false,
            textures: false
          };

          const mlSensoryPrediction = await mlModels.predictSensoryResponse(
            latestEnvironment,
            new Date()
          );

          if (mlSensoryPrediction) {
            collectedInsights.push({
              type: 'prediction',
              title: 'Sensory Response Prediction (ML)',
              description: `Machine learning predicts sensory responses based on current environment`,
              confidence: mlSensoryPrediction.confidence,
              timeframe: 'Current environment',
              recommendations: this.getMLSensoryRecommendations(mlSensoryPrediction),
              severity: mlSensoryPrediction.environmentalTriggers.length > 2 ? 'high' :
                       mlSensoryPrediction.environmentalTriggers.length > 0 ? 'medium' : 'low',
              source: 'ml',
              mlPrediction: mlSensoryPrediction
            });
          }
        }
      } catch (error) {
        logger.error('ML sensory prediction failed:', error);
      }
    }

    // Goal achievement prediction
    goals.forEach(goal => {
      const goalPrediction = this.predictGoalAchievement(goal);
      if (goalPrediction) {
        collectedInsights.push(goalPrediction);
      }
    });

    // Risk assessment
    const riskInsights = this.assessRisks(emotions, sensoryInputs, trackingEntries);
    collectedInsights.push(...riskInsights);

    return collectedInsights;
  }

  // Enhanced Trend Analysis with Statistical Significance
  analyzeTrendsWithStatistics(data: { value: number; timestamp: Date }[]): TrendAnalysis | null {
    // Capture config snapshot once per operation
    const cfgAny: any = analyticsConfig as any;
    const cfg = typeof cfgAny.get === 'function' ? cfgAny.get() : analyticsConfig.getConfig();
    const { enhancedAnalysis, analytics, timeWindows } = cfg;

    if (data.length < enhancedAnalysis.minSampleSize) return null;

    // Sort by timestamp without mutating the input
    const sortedData = [...data].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    
    // Robust linear regression (Huber) for slope/intercept on x=0..n-1, y=values
    const n = sortedData.length;
    const x = sortedData.map((_, i) => i);
    const y = sortedData.map(d => d.value);

    const huberCfg = enhancedAnalysis?.huber || { delta: 1.345, maxIter: 50, tol: 1e-6 };
    const { slope, intercept } = huberRegression(x, y, {
      maxIter: Number.isFinite(huberCfg.maxIter) ? huberCfg.maxIter : 50,
      tol: Number.isFinite(huberCfg.tol) ? huberCfg.tol : 1e-6,
      delta: Number.isFinite(huberCfg.delta) ? huberCfg.delta : 1.345,
    });

    // Compute predictions and R^2 against actuals with guards for invalid values
    const interceptSafe = Number.isFinite(intercept) ? intercept : 0;
    // Build safe pairs for R^2
    const xSafe: number[] = [];
    const ySafe: number[] = [];
    for (let i = 0; i < n; i++) {
      const yi = y[i];
      if (Number.isFinite(yi)) {
        xSafe.push(x[i]);
        ySafe.push(yi);
      }
    }
    const m = xSafe.length;
    const yPred: number[] = new Array(n);
    for (let i = 0; i < n; i++) {
      const xi = x[i];
      const pred = (Number.isFinite(slope) ? slope * xi + interceptSafe : interceptSafe);
      yPred[i] = Number.isFinite(pred) ? pred : 0;
    }
    let rSquared = 0;
    if (m >= 2) {
      const yMean = ySafe.reduce((a, b) => a + b, 0) / m;
      let ssRes = 0;
      let ssTot = 0;
      for (let k = 0; k < m; k++) {
        const idx = xSafe[k];
        const resid = ySafe[k] - yPred[idx];
        ssRes += resid * resid;
        const dy = ySafe[k] - yMean;
        ssTot += dy * dy;
      }
      rSquared = ssTot === 0 ? 0 : Math.max(0, Math.min(1, 1 - ssRes / ssTot));
    }

    // Time span and daily rate (safe timespan guards)
    const timeSpanDays = differenceInDays(
      sortedData[sortedData.length - 1].timestamp,
      sortedData[0].timestamp
    );
    const safeTimeSpanDays = Math.max(1, timeSpanDays || 0);
    const dailyRate = Number.isFinite(slope) ? slope * (n / safeTimeSpanDays) : 0;
    
    // Data and timespan quality from configured targets
    const pointsTarget = Number(enhancedAnalysis?.qualityTargets?.pointsTarget);
    const timeSpanTarget = Number(enhancedAnalysis?.qualityTargets?.timeSpanDaysTarget);
    const dataQuality = Number.isFinite(pointsTarget) && pointsTarget > 0 ? Math.min(1, n / pointsTarget) : 0;
    const timeSpanQuality = Number.isFinite(timeSpanTarget) && timeSpanTarget > 0 ? Math.min(1, timeSpanDays / timeSpanTarget) : 0;
    const patternStrength = Math.max(0, rSquared);
    const enhancedConfidenceRaw = dataQuality * 0.3 + timeSpanQuality * 0.3 + patternStrength * 0.4;
    const enhancedConfidence = Number.isFinite(enhancedConfidenceRaw) ? enhancedConfidenceRaw : 0;

    // Determine direction using configured threshold
    const threshold = Number(enhancedAnalysis?.trendThreshold) || 0;
    const direction = Math.abs(dailyRate) < threshold ? 'stable' : dailyRate > 0 ? 'increasing' : 'decreasing';

    // Forecasts (ensure finite values)
    const lastPred = yPred[yPred.length - 1] ?? 0;
    const slopeSafe = Number.isFinite(slope) ? slope : 0;
    const next7 = lastPred + slopeSafe * (Number(timeWindows?.recentDataDays) || 7);
    const next30 = lastPred + slopeSafe * (Number(timeWindows?.defaultAnalysisDays) || 30);

    return {
      metric: 'Overall Trend',
      direction,
      rate: Number.isFinite(dailyRate) ? dailyRate : 0,
      significance: Number.isFinite(rSquared) ? rSquared : 0,
      confidence: enhancedConfidence,
      forecast: {
        next7Days: Number.isFinite(next7) ? next7 : 0,
        next30Days: Number.isFinite(next30) ? next30 : 0,
        confidence: enhancedConfidence,
      },
    };
  }

  // Generate confidence explanation
  generateConfidenceExplanation(
    dataPoints: number,
    timeSpanDays: number,
    rSquared: number,
    confidence: number
  ): { level: 'low' | 'medium' | 'high'; explanation: string; factors: string[] } {
    // Capture config snapshot once per operation
    const cfgAny: any = analyticsConfig as any;
    const cfg = typeof cfgAny.get === 'function' ? cfgAny.get() : analyticsConfig.getConfig();
    const { enhancedAnalysis, timeWindows, insights, patternAnalysis } = cfg || {} as any;

    const factors: string[] = [];
    let explanation = '';
    let level: 'low' | 'medium' | 'high' = 'low';

    // Minimum sample size factor (guard missing config)
    if (typeof enhancedAnalysis?.minSampleSize === 'number') {
      if (dataPoints < enhancedAnalysis.minSampleSize) {
        factors.push(`insufficientData:${dataPoints}:${enhancedAnalysis.minSampleSize}`);
      } else {
        // Include a positive factor documenting threshold used
        factors.push(`sufficientData:${dataPoints}:${enhancedAnalysis.minSampleSize}`);
      }
    }

    // Time window factor: compare against shortTermDays, label with defaultAnalysisDays if available
    if (typeof timeWindows?.shortTermDays === 'number') {
      const defaultDays = typeof timeWindows?.defaultAnalysisDays === 'number' ? timeWindows.defaultAnalysisDays : undefined;
      if (timeSpanDays < timeWindows.shortTermDays) {
        factors.push(
          defaultDays != null
            ? `shortTimespan:${timeSpanDays}:${defaultDays}`
            : `shortTimespan:${timeSpanDays}`
        );
      } else {
        factors.push(
          defaultDays != null
            ? `adequateTimespan:${timeSpanDays}:${defaultDays}`
            : `adequateTimespan:${timeSpanDays}`
        );
      }
    }

    // rSquared strength bands using configured significance thresholds (guard missing)
    const sig = enhancedAnalysis?.correlationSignificance;
    if (sig && typeof sig.low === 'number' && typeof sig.moderate === 'number' && typeof sig.high === 'number') {
      if (rSquared < sig.low) {
        factors.push(`weakPattern:${rSquared.toFixed(3)}:low=${sig.low}`);
      } else if (rSquared >= sig.high) {
        factors.push(`strongPattern:${rSquared.toFixed(3)}:high=${sig.high}`);
      } else if (rSquared >= sig.moderate) {
        factors.push(`moderatePattern:${rSquared.toFixed(3)}:moderate=${sig.moderate}`);
      } else {
        factors.push(`lowPattern:${rSquared.toFixed(3)}:low=${sig.low}`);
      }
    } else {
      // Fallback to legacy correlationThreshold if available
      if (typeof patternAnalysis?.correlationThreshold === 'number') {
        const corrT = patternAnalysis.correlationThreshold;
        const strongCut = Math.max(0.7, corrT + 0.4);
        if (rSquared < corrT) {
          factors.push(`weakPattern:${rSquared.toFixed(3)}:ct=${corrT}`);
        } else if (rSquared > strongCut) {
          factors.push(`strongPattern:${rSquared.toFixed(3)}:ct=${corrT}`);
        } else {
          factors.push(`moderatePattern:ct=${corrT}`);
        }
      } else {
        // No threshold available; avoid bold claims
        factors.push('moderatePattern');
      }
    }

    // Determine overall level and explanation using insights.HIGH_CONFIDENCE_PATTERN_THRESHOLD
    if (typeof insights?.HIGH_CONFIDENCE_PATTERN_THRESHOLD === 'number') {
      const highT = insights.HIGH_CONFIDENCE_PATTERN_THRESHOLD;
      const medT = highT - 0.2;
      if (confidence >= highT) {
        level = 'high';
        // Prefer "excellentData" when rSquared exceeds strong band; else "reliableInsight"
        if (typeof patternAnalysis?.correlationThreshold === 'number') {
          const corrT = patternAnalysis.correlationThreshold;
          const strongCut = Math.max(0.7, corrT + 0.4);
          explanation = rSquared > strongCut ? 'excellentData' : 'reliableInsight';
        } else {
          explanation = 'reliableInsight';
        }
      } else if (confidence >= medT) {
        level = 'medium';
        explanation = 'emergingTrend';
      } else {
        level = 'low';
        explanation = 'needMoreData';
      }
    } else {
      // Missing threshold -> minimal/confidently safe output
      level = 'low';
      explanation = 'needMoreData';
    }

    return { level, explanation, factors };
  }

  // Anomaly Detection using Statistical Methods
  detectAnomalies(
    emotions: EmotionEntry[],
    sensoryInputs: SensoryEntry[],
    trackingEntries: TrackingEntry[]
  ): AnomalyDetection[] {
    // Capture config snapshot once per operation
    const cfgAny: any = analyticsConfig as any;
    const cfg = typeof cfgAny.get === 'function' ? cfgAny.get() : analyticsConfig.getConfig();
    const { enhancedAnalysis, alertSensitivity } = cfg;

    const anomalies: AnomalyDetection[] = [];

    // Emotion intensity anomalies
    const emotionIntensities = emotions.map(e => e.intensity);

    // Apply anomaly sensitivity multiplier (base threshold)
    const anomalyThreshold = enhancedAnalysis.anomalyThreshold * alertSensitivity.anomalyMultiplier;
    const severityLevels = enhancedAnalysis.anomalySeverityLevels || { medium: 2.5, high: 3.0 };

    const zEmotion = zScoresMedian(emotionIntensities);

    emotions.forEach((emotion, idx) => {
      const zScore = Math.abs(zEmotion[idx] ?? 0);
      if (zScore > anomalyThreshold) {
        const severity: 'low' | 'medium' | 'high' =
          zScore >= severityLevels.high ? 'high' : zScore >= severityLevels.medium ? 'medium' : 'low';
        anomalies.push({
          timestamp: emotion.timestamp,
          type: 'emotion',
          severity,
          description: `Unusual ${emotion.emotion} intensity detected (${emotion.intensity}/5)`,
          deviationScore: zScore,
          recommendations: this.getAnomalyRecommendations('emotion', emotion.emotion, zScore)
        });
      }
    });

    // Sensory frequency anomalies
    const dailySensoryCounts = this.groupSensoryByDay(sensoryInputs);
    const counts = Object.values(dailySensoryCounts);
    if (counts.length > 0) {
      const zCounts = zScoresMedian(counts);
      const dates = Object.keys(dailySensoryCounts);

      dates.forEach((date, idx) => {
        const count = dailySensoryCounts[date];
        const zScore = Math.abs(zCounts[idx] ?? 0);
        if (zScore > anomalyThreshold) {
          const severity: 'low' | 'medium' | 'high' =
            zScore >= severityLevels.high ? 'high' : zScore >= severityLevels.medium ? 'medium' : 'low';
          anomalies.push({
            timestamp: new Date(date),
            type: 'sensory',
            severity,
            description: `Unusual sensory activity level detected (${count} inputs)`,
            deviationScore: zScore,
            recommendations: this.getAnomalyRecommendations('sensory', 'frequency', zScore)
          });
        }
      });
    }

    return anomalies.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  // Comprehensive Correlation Matrix
  generateCorrelationMatrix(trackingEntries: TrackingEntry[]): CorrelationMatrix {
    // Capture config snapshot once per operation
    const cfgAny: any = analyticsConfig as any;
    const cfg = typeof cfgAny.get === 'function' ? cfgAny.get() : analyticsConfig.getConfig();
    const { enhancedAnalysis, patternAnalysis, taxonomy } = cfg;

    const factors = [
      'avgEmotionIntensity',
      'positiveEmotionRatio',
      'sensorySeekingRatio',
      'noiseLevel',
      'temperature',
      'lightingQuality'
    ];

    // Build positive emotion lookup from taxonomy (case-insensitive)
    const positiveSet = new Set((taxonomy?.positiveEmotions || []).map(e => e.toLowerCase()));

    const dataPoints = trackingEntries.map(entry => ({
      avgEmotionIntensity: entry.emotions.length > 0 
        ? entry.emotions.reduce((sum, e) => sum + e.intensity, 0) / entry.emotions.length 
        : 0,
      positiveEmotionRatio: entry.emotions.length > 0
        ? entry.emotions.filter(e => positiveSet.has(e.emotion.toLowerCase())).length / entry.emotions.length
        : 0,
      sensorySeekingRatio: entry.sensoryInputs.length > 0
        ? entry.sensoryInputs.filter(s => s.response.toLowerCase().includes('seeking')).length / entry.sensoryInputs.length
        : 0,
      noiseLevel: entry.environmentalData?.roomConditions?.noiseLevel || 0,
      temperature: entry.environmentalData?.roomConditions?.temperature || 0,
      lightingQuality: this.convertLightingToNumeric(entry.environmentalData?.roomConditions?.lighting)
    }));

    const matrix: number[][] = [];
    const significantPairs: CorrelationMatrix['significantPairs'] = [];

    // Significance thresholds from config with safe fallbacks
    const sig = enhancedAnalysis?.correlationSignificance;
    const baseThreshold = Math.max(0, Math.min(1, (sig?.low ?? patternAnalysis.correlationThreshold ?? 0.3)));
    const moderateCut = Math.max(baseThreshold, Math.min(1, sig?.moderate ?? (baseThreshold + 0.2)));
    const highCut = Math.max(moderateCut, Math.min(1, sig?.high ?? (baseThreshold + 0.4)));

    factors.forEach((factor1, i) => {
      matrix[i] = [];
      factors.forEach((factor2, j) => {
        // Build paired arrays guarding index alignment and validity
        const x: number[] = [];
        const y: number[] = [];
        for (let k = 0; k < dataPoints.length; k++) {
          const dv = dataPoints[k] as any;
          const v1 = dv[factor1];
          const v2 = dv[factor2];
          if (typeof v1 === 'number' && Number.isFinite(v1) && typeof v2 === 'number' && Number.isFinite(v2)) {
            x.push(v1);
            y.push(v2);
          }
        }

        const nPairs = x.length;
        const correlation = pearsonCorrelation(x, y);
        matrix[i][j] = correlation;

        // Significance gate uses |r| >= baseThreshold and minimum sample size from enhancedAnalysis
        if (i < j && Math.abs(correlation) >= baseThreshold && nPairs >= enhancedAnalysis.minSampleSize) {
          const pValue = pValueForCorrelation(correlation, nPairs);
          const absR = Math.abs(correlation);
          const significance: 'low' | 'moderate' | 'high' =
            absR >= highCut ? 'high' : absR >= moderateCut ? 'moderate' : 'low';

          significantPairs.push({
            factor1,
            factor2,
            correlation,
            pValue,
            significance
          });
        }
      });
    });

    return {
      factors,
      matrix,
      significantPairs: significantPairs.sort((a, b) => Math.abs(b.correlation) - Math.abs(a.correlation))
    };
  }

  // Helper Methods
  private analyzeEmotionTrend(emotions: EmotionEntry[]): TrendAnalysis | null {
    const emotionData = emotions.map(e => ({
      value: e.intensity,
      timestamp: e.timestamp
    }));

    return this.analyzeTrendsWithStatistics(emotionData);
  }

  private analyzeSensoryTrend(sensoryInputs: SensoryEntry[]): TrendAnalysis | null {
    // Convert sensory responses to numeric values for trend analysis
    const sensoryData = sensoryInputs.map(s => ({
      value: s.response.toLowerCase().includes('seeking') ? 1 : 
             s.response.toLowerCase().includes('avoiding') ? -1 : 0,
      timestamp: s.timestamp
    }));

    return this.analyzeTrendsWithStatistics(sensoryData);
  }

  private predictGoalAchievement(goal: Goal): PredictiveInsight | null {
    if (!goal.dataPoints || goal.dataPoints.length < 3) return null;

    const progressData = goal.dataPoints.map(dp => ({
      value: dp.value,
      timestamp: dp.timestamp
    }));

    const trend = this.analyzeTrendsWithStatistics(progressData);
    if (!trend) return null;

    const currentProgress = goal.dataPoints[goal.dataPoints.length - 1].value;
    const targetValue = goal.targetValue;
    const remainingProgress = targetValue - currentProgress;
    const estimatedDays = trend.rate > 0 ? remainingProgress / trend.rate : -1;

    return {
      type: 'prediction',
      title: `Goal Achievement Forecast: ${goal.title}`,
      description: estimatedDays > 0 
        ? `Estimated ${Math.ceil(estimatedDays)} days to achieve goal at current pace`
        : 'Goal may require strategy adjustment based on current trend',
      confidence: trend.significance,
      timeframe: 'Goal completion forecast',
      prediction: {
        value: targetValue,
        trend: trend.direction,
        accuracy: trend.significance
      },
      recommendations: this.getGoalRecommendations(goal, trend, estimatedDays),
      severity: estimatedDays < 0 ? 'high' : estimatedDays > 60 ? 'medium' : 'low'
    };
  }

  private assessRisks(
    emotions: EmotionEntry[],
    sensoryInputs: SensoryEntry[],
    trackingEntries: TrackingEntry[]
  ): PredictiveInsight[] {
    // Capture config snapshot once per operation (private helper still snapshots to avoid nested reads)
    const cfgAny: any = analyticsConfig as any;
    const cfg = typeof cfgAny.get === 'function' ? cfgAny.get() : analyticsConfig.getConfig();
    const { timeWindows, enhancedAnalysis, alertSensitivity } = cfg;

    const risks: PredictiveInsight[] = [];
    const recentData = {
      emotions: emotions.filter(e => e.timestamp >= subDays(new Date(), timeWindows.shortTermDays)),
      sensoryInputs: sensoryInputs.filter(s => s.timestamp >= subDays(new Date(), timeWindows.shortTermDays)),
      trackingEntries: trackingEntries.filter(t => t.timestamp >= subDays(new Date(), timeWindows.shortTermDays))
    };

    // Apply sensitivity multiplier for risk assessment
    // Incidents threshold: prefer configured value if present; fallback to 3
    const incidentsThreshold = Math.max(1, Math.floor((enhancedAnalysis as any)?.riskAssessmentThreshold ?? 3));

    // High stress accumulation risk (use configured intensity and emotions)
    const stressIntensityT = cfg?.enhancedAnalysis?.riskAssessment?.stressIntensityThreshold;
    const stressEmotionsCfg = cfg?.enhancedAnalysis?.riskAssessment?.stressEmotions;
    const stressEmotions = Array.isArray(stressEmotionsCfg) ? stressEmotionsCfg.map((e: string) => e.toLowerCase()) : [];

    let highStressCount = 0;
    if (typeof stressIntensityT === 'number' && stressEmotions.length > 0) {
      highStressCount = recentData.emotions.filter(e =>
        e.intensity >= stressIntensityT && stressEmotions.includes(e.emotion.toLowerCase())
      ).length;
    }

    if (highStressCount >= incidentsThreshold && highStressCount > 0) {
      risks.push({
        type: 'risk',
        title: 'Stress Accumulation Risk',
        description: `${highStressCount} high-stress incidents in the past 2 weeks`,
        confidence: 0.8,
        timeframe: 'Immediate attention needed',
        recommendations: [
          'Implement immediate stress reduction strategies',
          'Review and adjust current interventions',
          'Consider environmental modifications',
          'Schedule additional support sessions'
        ],
        severity: 'high'
      });
    }

    return risks;
  }

  private groupSensoryByDay(sensoryInputs: SensoryEntry[]): Record<string, number> {
    return sensoryInputs.reduce((acc, input) => {
      const date = format(input.timestamp, 'yyyy-MM-dd');
      acc[date] = (acc[date] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }

  private convertLightingToNumeric(lighting?: string): number {
    const lightingMap: Record<string, number> = {
      'dim': 1,
      'normal': 2,
      'bright': 3,
      'fluorescent': 2.5,
      'natural': 3.5
    };
    return lightingMap[lighting?.toLowerCase() || ''] || 2;
  }

  private getEmotionTrendRecommendations(trend: TrendAnalysis): string[] {
    if (trend.direction === 'decreasing') {
      return [
        'Increase positive reinforcement strategies',
        'Review environmental factors that may be contributing to stress',
        'Consider additional sensory support tools',
        'Schedule more frequent check-ins'
      ];
    } else if (trend.direction === 'increasing') {
      return [
        'Continue current successful strategies',
        'Document what is working well',
        'Gradually introduce new challenges',
        'Share progress with student and family'
      ];
    }
    return [
      'Monitor for changes in patterns',
      'Maintain current support level',
      'Be prepared to adjust strategies as needed'
    ];
  }

  private getSensoryTrendRecommendations(trend: TrendAnalysis): string[] {
    if (trend.rate > 0) { // Increasing seeking
      return [
        'Provide more structured sensory breaks',
        'Introduce additional sensory tools',
        'Consider sensory diet adjustments',
        'Monitor for overstimulation'
      ];
    } else if (trend.rate < 0) { // Increasing avoiding
      return [
        'Reduce environmental stimuli',
        'Provide more quiet spaces',
        'Gradually reintroduce sensory experiences',
        'Focus on calming strategies'
      ];
    }
    return [
      'Maintain current sensory support level',
      'Continue monitoring sensory preferences',
      'Be responsive to daily variations'
    ];
  }

  private getGoalRecommendations(goal: Goal, trend: TrendAnalysis, estimatedDays: number): string[] {
    if (estimatedDays < 0) {
      return [
        'Review and adjust goal strategies',
        'Break goal into smaller milestones',
        'Identify and address barriers',
        'Consider modifying timeline or approach'
      ];
    } else if (estimatedDays > 90) {
      return [
        'Increase intervention frequency',
        'Add additional support strategies',
        'Review goal expectations',
        'Provide more immediate reinforcement'
      ];
    }
    return [
      'Continue current approach',
      'Monitor progress regularly',
      'Celebrate milestones reached',
      'Maintain consistent support'
    ];
  }

  private getAnomalyRecommendations(type: string, context: string, severity: number): string[] {
    if (type === 'emotion') {
      return [
        'Investigate potential triggers for this emotional spike',
        'Provide immediate support and coping strategies',
        'Monitor closely for additional unusual patterns',
        'Consider environmental or schedule changes'
      ];
    } else if (type === 'sensory') {
      return [
        'Review sensory environment for unusual factors',
        'Check for changes in routine or schedule',
        'Provide additional sensory regulation support',
        'Monitor for illness or other physical factors'
      ];
    }
    return [
      'Investigate potential causes',
      'Provide additional support',
      'Monitor closely',
      'Document and track patterns'
    ];
  }

  private getTrendSeverity(trend: TrendAnalysis): 'low' | 'medium' | 'high' {
    // Use configured significance bands; default to 0.7/0.5 if missing
    const cfgAny: any = analyticsConfig as any;
    const cfg = typeof cfgAny.get === 'function' ? cfgAny.get() : analyticsConfig.getConfig();
    const bands = cfg?.enhancedAnalysis?.correlationSignificance;
    const highT = typeof bands?.high === 'number' ? bands.high : 0.7;
    const medT = typeof bands?.moderate === 'number' ? bands.moderate : 0.5;

    if (trend.direction === 'decreasing' && trend.significance >= highT) return 'high';
    if (trend.direction === 'decreasing' && trend.significance >= medT) return 'medium';
    return 'low';
  }

  private getMLEmotionRecommendations(predictions: EmotionPrediction[], trend: string): string[] {
    const highAnxietyDays = predictions.filter(p => p.emotions.anxious > 7).length;
    const lowPositiveDays = predictions.filter(p => p.emotions.happy < 3 && p.emotions.calm < 3).length;

    const recommendations: string[] = [];

    if (highAnxietyDays >= 3) {
      recommendations.push('ML predicts elevated anxiety - implement proactive calming strategies');
      recommendations.push('Schedule additional check-ins on high-anxiety days');
    }

    if (lowPositiveDays >= 4) {
      recommendations.push('ML indicates low positive emotions upcoming - increase engagement activities');
      recommendations.push('Prepare mood-boosting interventions');
    }

    if (trend === 'increasing') {
      recommendations.push('ML shows increasing emotional intensity - monitor for triggers');
    } else if (trend === 'decreasing') {
      recommendations.push('ML shows decreasing emotional engagement - check for withdrawal signs');
    }

    recommendations.push('Compare ML predictions with actual outcomes to refine models');

    return recommendations;
  }

  private getMLSensoryRecommendations(prediction: SensoryPrediction): string[] {
    const recommendations: string[] = [];

    // Check each sensory modality
    const cfgAny: any = analyticsConfig as any;
    const cfg = typeof cfgAny.get === 'function' ? cfgAny.get() : analyticsConfig.getConfig();
    const bands = cfg?.enhancedAnalysis?.correlationSignificance;
    const highBand = typeof bands?.high === 'number' ? bands.high : 0.7;

    Object.entries(prediction.sensoryResponse).forEach(([sense, response]) => {
      if (response.avoiding > highBand) {
        recommendations.push(`High ${sense} avoidance predicted - minimize ${sense} stimuli`);
      } else if (response.seeking > highBand) {
        recommendations.push(`High ${sense} seeking predicted - provide ${sense} input opportunities`);
      }
    });

    // Environmental trigger recommendations
    prediction.environmentalTriggers.forEach(trigger => {
      if (trigger.probability > highBand) {
        recommendations.push(`High probability of reaction to ${trigger.trigger} - prepare alternatives`);
      }
    });

    return recommendations;
  }

  // Baseline analysis using ML clustering
  async analyzeBaseline(trackingEntries: TrackingEntry[]): Promise<BaselineCluster[]> {
    // Capture config snapshot once per operation (kept for parity/future use)
    const cfgAny: any = analyticsConfig as any;
    const cfg = typeof cfgAny.get === 'function' ? cfgAny.get() : analyticsConfig.getConfig();
    const { enhancedAnalysis, patternAnalysis, timeWindows, alertSensitivity, analytics, insights, taxonomy } = cfg;

    if (!this.mlModelsInitialized || trackingEntries.length < 10) {
      return [];
    }

    try {
      const clusters = await mlModels.performBaselineClustering(trackingEntries, 3);
      return clusters;
    } catch (error) {
      logger.error('Baseline clustering failed:', error);
      return [];
    }
  }
}

export const enhancedPatternAnalysis = new EnhancedPatternAnalysisEngine();