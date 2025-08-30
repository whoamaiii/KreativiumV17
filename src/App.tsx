import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import React, { Suspense, lazy } from "react";
import { POC_MODE, IS_PROD } from "@/lib/env";
if (!POC_MODE) {
  await import("@/lib/analyticsConfigOverride");
}
import { ThemeProvider } from "next-themes";
import { TegnXPProvider } from "@/contexts/TegnXPContext";
import { DevErrorBanner } from "@/components/DevErrorBanner";
import { AccessibilityWrapper } from "@/components/AccessibilityWrapper";
import { LoadingFallback } from "@/components/LoadingFallback";

const Dashboard = lazy(() => import("./pages/Dashboard").then(m => ({ default: m.Dashboard })));
// These pages export default components; import defaults directly to avoid undefined lazy resolutions
const AddStudent = lazy(() => import("./pages/AddStudent"));
const StudentProfile = lazy(() => import("./pages/StudentProfile").then(m => ({ default: m.StudentProfile })));
const TrackStudent = lazy(() => import("./pages/TrackStudent"));
const NotFound = lazy(() => import("./pages/NotFound"));
const TegnLayout = lazy(() => import("./pages/TegnLayout"));
const TegnTilTaleMenu = lazy(() => import("./pages/TegnTilTaleMenu"));
const SignLearnPage = lazy(() => import("./pages/SignLearnPage"));
const SignIndexPage = lazy(() => import("./pages/SignIndexPage"));
const SignMemoryPage = lazy(() => import("./pages/SignMemoryPage"));
const SignProgressPage = lazy(() => import("./pages/SignProgressPage"));
const Settings = lazy(() => import("./pages/Settings"));
const Reports = lazy(() => import("./pages/Reports"));
const InteractiveVizTest = (!IS_PROD || POC_MODE)
  ? lazy(() => import('./pages/InteractiveVizTest').then(m => ({ default: m.default })))
  : null as unknown as React.LazyExoticComponent<() => JSX.Element>;
const EnvironmentalCorrelationsTest = (!IS_PROD || POC_MODE)
  ? lazy(() => import("./pages/EnvironmentalCorrelationsTest"))
  : null as unknown as React.LazyExoticComponent<() => JSX.Element>;
import { ErrorWrapper } from "./components/ErrorWrapper";

// Additional lazies for custom routes
const ReportBuilderPage = lazy(() => import('./pages/ReportBuilderPage').then(m => ({ default: m.default })));

// Lazy-loaded Developer Tools page (non-prod/POC only)
const DevTools = !IS_PROD || POC_MODE
  ? lazy(() => import("./pages/DevTools").then(m => ({ default: m.default })))
  : null as unknown as React.LazyExoticComponent<() => JSX.Element>;

const queryClient = new QueryClient();

const App = () => (
  <ErrorWrapper>
    <AccessibilityWrapper>
      {!IS_PROD && <DevErrorBanner />}
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        <QueryClientProvider client={queryClient}>
          <TooltipProvider>
            <Toaster />
            <BrowserRouter>
              <TegnXPProvider>
                <Suspense fallback={<LoadingFallback />}>
                  <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/add-student" element={<AddStudent />} />
                <Route path="/student/:studentId" element={<StudentProfile />} />
                <Route path="/track/:studentId" element={<TrackStudent />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/reports" element={<Reports />} />
                {/* Export tools (previous /reports) */}
                <Route path="/reports/export" element={<Reports />} />
                {/* Report Builder route */}
                <Route path="/reports/builder" element={<ReportBuilderPage />} />
                <Route path="/tegn" element={<TegnLayout />}>
                  <Route index element={<TegnTilTaleMenu />} />
                  <Route path="learn" element={<SignLearnPage />} />
                  <Route path="tegnbase" element={<SignIndexPage />} />
                  <Route path="memory" element={<SignMemoryPage />} />
                  <Route path="progress" element={<SignProgressPage />} />
                </Route>
                {!IS_PROD && EnvironmentalCorrelationsTest && (
                  <Route path="/environmental-correlations-test" element={<EnvironmentalCorrelationsTest />} />
                )}
                {(!IS_PROD || POC_MODE) && InteractiveVizTest && (
                  <Route path="/e2e/interactive-viz" element={<InteractiveVizTest />} />
                )}
                {(!IS_PROD || POC_MODE) && DevTools && (
                  <Route path="/dev-tools" element={<DevTools />} />
                )}
                {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                <Route path="*" element={<NotFound />} />
                  </Routes>
                </Suspense>
              </TegnXPProvider>
            </BrowserRouter>
          </TooltipProvider>
        </QueryClientProvider>
      </ThemeProvider>
    </AccessibilityWrapper>
  </ErrorWrapper>
);

export { App };
