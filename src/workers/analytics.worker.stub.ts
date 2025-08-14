// Minimal stub worker used in POC mode to avoid bundling heavy analytics code
// Posts a single complete message with empty-but-valid results

 
self.onmessage = (event: MessageEvent) => {
  const data: any = event.data || {};
  const cacheKey = data.cacheKey;
   
  (self as unknown as Worker).postMessage({
    type: 'complete',
    payload: {
      patterns: [],
      correlations: [],
      environmentalCorrelations: [],
      predictiveInsights: [],
      anomalies: [],
      insights: ['POC mode: lightweight analytics stub'],
      cacheKey
    }
  });
};


