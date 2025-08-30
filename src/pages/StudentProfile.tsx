import { useState, useEffect, useCallback, memo, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { StudentProfileSidebar } from "@/components/StudentProfileSidebar";
import { DashboardSection } from "@/components/profile-sections/DashboardSection";
import { AnalyticsSection } from "@/components/profile-sections/AnalyticsSection";
import { ToolsSection } from "@/components/profile-sections/ToolsSection";
import { GoalManager } from "@/components/GoalManager";
import { ProgressDashboard } from "@/components/ProgressDashboard";
import { LazyReportBuilder } from "@/components/lazy/LazyReportBuilder";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { useDataFiltering } from "@/hooks/useDataFiltering";
import { useOptimizedInsights } from "@/hooks/useOptimizedInsights";
import { useStudentData } from "@/hooks/useStudentData";
import { Insights } from "@/types/student";
import { exportSystem } from "@/lib/exportSystem";
import { downloadBlob } from "@/lib/utils";
import { ArrowLeft, Download, Save, FileText, Calendar, Loader } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "@/hooks/useTranslation";
import { LanguageSettings } from "@/components/LanguageSettings";
import { GlobalMenu } from "@/components/GlobalMenu";
import { analyticsManager } from "@/lib/analyticsManager";
import { logger } from "@/lib/logger";
import { dataStorage } from "@/lib/dataStorage";
import { seedMinimalDemoData } from "@/lib/mockData";

// Centralized className constants to satisfy react/jsx-no-literals for attribute strings
const fullScreenCenterCls = "h-screen w-full flex items-center justify-center";
const rowGap2Cls = "flex items-center gap-2";
const textMutedCls = "text-muted-foreground";
const textDestructiveCls = "text-destructive";
const pageRootCls = "min-h-screen w-full bg-background font-dyslexia flex";
const mainCls = "flex-1 overflow-auto relative z-0";
const headerCls = "border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-30";
const headerInnerCls = "flex h-14 items-center justify-between px-6";
const flexGap3Cls = "flex items-center gap-3";
const BTN_VARIANT_GHOST = "ghost";
const BTN_VARIANT_OUTLINE = "outline";
const BTN_SIZE_SM = "sm";
const iconSmCls = "h-4 w-4 mr-2";
const containerPaddingCls = "p-6";
const spaceY6Cls = "space-y-6";
const titleCls = "text-2xl font-bold";
const centerMutedCls = "text-center py-8 text-muted-foreground";
const loaderIconCls = "h-5 w-5 animate-spin";
const reportsActionsCls = "flex flex-wrap gap-3 p-4 bg-gradient-card rounded-lg border-0 shadow-soft";

/**
 * Memoized versions of section components to prevent unnecessary re-renders.
 * These components will only re-render if their specific props change.
 */
const MemoizedDashboardSection = memo(DashboardSection);
const MemoizedAnalyticsSection = memo(AnalyticsSection);
const MemoizedToolsSection = memo(ToolsSection);
const MemoizedGoalManager = memo(GoalManager);
const MemoizedProgressDashboard = memo(ProgressDashboard);
const MemoizedLazyReportBuilder = memo(LazyReportBuilder);

/**
 * @component StudentProfile
 * 
 * This is a top-level component that serves as the main profile page for a single student.
 * It orchestrates data fetching, state management, and rendering for all sub-sections
 * related to a student, such as their dashboard, analytics, goals, and reports.
 * 
 * Key Responsibilities:
 * - Fetches all necessary data for a given student ID using the `useStudentData` hook.
 * - Manages the active view (e.g., dashboard, analytics) through the `activeSection` state.
 * - Handles data filtering based on date ranges.
 * - Generates AI-powered insights asynchronously.
 * - Provides functionality for data export and backup.
 * - Renders the appropriate section component based on the user's navigation.
 */
const StudentProfile = () => {
  const { studentId } = useParams<{ studentId: string }>();
  const navigate = useNavigate();
  const { tCommon, t } = useTranslation();

  // DIAGNOSTIC: Mount parameters
  if (import.meta.env.DEV) {
    logger.debug('[DIAGNOSTIC] StudentProfile mount', { studentId });
  }

  const {
    student,
    trackingEntries,
    allEmotions,
    allSensoryInputs,
    goals,
    isLoading: isLoadingStudent,
    error: studentError,
    reloadGoals,
    reloadData,
  } = useStudentData(studentId);

  // DIAGNOSTIC: After data hook
  if (import.meta.env.DEV) {
    try {
      logger.debug('[DIAGNOSTIC] useStudentData snapshot', {
        hasStudent: !!student,
        studentId,
        studentName: student?.name,
        trackingEntriesCount: trackingEntries?.length ?? 0,
        emotionsCount: allEmotions?.length ?? 0,
        sensoryInputsCount: allSensoryInputs?.length ?? 0,
        goalsCount: goals?.length ?? 0,
        isLoadingStudent,
        studentError
      });
    } catch (_err) {
      logger.debug('[DIAGNOSTIC] useStudentData snapshot logging failed');
    }
  }

  // State to control which profile section is currently visible.
  const [activeSection, setActiveSection] = useState('dashboard');
  const handleSectionChange = useCallback((section: string) => {
    try { logger.debug('[UI] Active section change', { from: activeSection, to: section }); } catch (_err) { void 0; }
    setActiveSection(section);
  }, [activeSection]);
  
  // Ref to guard against duplicate seeding
  const seedingRef = useRef(false);
  const [, setIsSeedingData] = useState(false);

  // Hook for filtering tracking data by a selected date range.
  const { selectedRange, filteredData, handleRangeChange } = useDataFiltering(
    trackingEntries,
    allEmotions,
    allSensoryInputs
  );

  const { getInsights } = useOptimizedInsights(
    filteredData.emotions,
    filteredData.sensoryInputs,
    filteredData.entries
  );

  // State for storing and managing the loading of AI-generated insights.
  const [insights, setInsights] = useState<Insights | null>(null);
  const [isLoadingInsights, setIsLoadingInsights] = useState(false);

  /**
   * Auto-seed effect for mock student routes.
   * When navigating to /student/mock_* and storage is empty, auto-create minimal demo data.
   */
  useEffect(() => {
    const seedMockDataIfNeeded = async () => {
      // Check if the route is a mock route
      if (!studentId?.startsWith('mock_')) {
        return;
      }

      // Prevent duplicate seeding using ref guard
      if (seedingRef.current) {
        return;
      }

      // Only auto-seed when:
      // 1) storage is empty, OR
      // 2) this specific mock student already exists but lacks sufficient data
      const existingStudents = dataStorage.getStudents();
      const hasAnyStudents = existingStudents.length > 0;
      const mockStudentExists = !!dataStorage.getStudentById(studentId);
      const existingEntriesForMock = dataStorage.getEntriesForStudent(studentId) || [];
      const needsSeeding = !hasAnyStudents || (mockStudentExists && existingEntriesForMock.length < 8);
      if (!needsSeeding) {
        return;
      }

      // Set the guard to prevent re-runs
      seedingRef.current = true;
      setIsSeedingData(true);

      try {
        logger.info('Auto-seeding minimal demo data for mock route', { studentId });
        
        // Seed minimal demo data with the provided student ID
        await seedMinimalDemoData(studentId);
        
        // Dispatch custom event to notify other components
        window.dispatchEvent(new CustomEvent('mockDataLoaded'));
        
        // Show non-intrusive success message
        toast.success('Demo data created successfully', {
          description: 'Sample data has been generated for demonstration purposes',
        });
        
        // Reload the data to show the newly created student
        if (reloadData) {
          reloadData();
        }
      } catch (error) {
        logger.error('Failed to auto-seed mock data', { error, studentId });
        toast.error('Failed to create demo data', {
          description: 'Please try loading mock data manually',
        });
      } finally {
        setIsSeedingData(false);
      }
    };

    seedMockDataIfNeeded();
  }, [studentId, reloadData]);

  // Effect to handle errors from the data fetching hook.
  useEffect(() => {
    if (studentError) {
      toast.error(studentError);
      navigate('/');
    }
  }, [studentError, navigate]);

  /**
   * Effect for asynchronously generating student insights.
   * 
   * This effect runs whenever the filtered data or student context changes.
   * It uses an `AbortController` to prevent race conditions and to cancel
   * pending requests if the component unmounts or if dependencies change,
   * which is a robust pattern for handling async operations in useEffect.
   */
  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;

    const generateInsights = async () => {
      if (
        !student ||
        (filteredData.emotions.length === 0 &&
          filteredData.sensoryInputs.length === 0 &&
          filteredData.entries.length === 0)
      ) {
        setInsights(null);
        return;
      }

      setIsLoadingInsights(true);
      try {
        const newInsights = await getInsights();
        if (!signal.aborted) {
          setInsights(newInsights as Insights);
        }
      } catch (error) {
        if (!signal.aborted) {
          logger.error('Error generating insights', { error });
          setInsights(null);
          toast.error('Failed to generate insights');
        }
      } finally {
        if (!signal.aborted) {
          setIsLoadingInsights(false);
        }
      }
    };

    generateInsights();

    // Analytics triggers with diagnostics and isolation (fail-soft)
    try {
      if (student) {
        if (import.meta.env.DEV) {
          logger.debug('[DIAGNOSTIC] analyticsManager.triggerAnalyticsForStudent start', {
            studentId: student.id,
            name: student.name,
          });
        }
        // Do not block UI if analytics fails
        Promise.resolve(analyticsManager.triggerAnalyticsForStudent(student))
          .then(() => {
            if (import.meta.env.DEV) {
              logger.debug('[DIAGNOSTIC] analyticsManager.triggerAnalyticsForStudent done');
            }
          })
          .catch((err) => {
            logger.error('[SAFE] analyticsManager.triggerAnalyticsForStudent failed', { error: err, studentId: student.id });
          });
      } else if (studentId) {
        if (import.meta.env.DEV) {
          logger.debug('[DIAGNOSTIC] analyticsManager.initializeStudentAnalytics start', { studentId });
        }
        try {
          analyticsManager.initializeStudentAnalytics(studentId);
          if (import.meta.env.DEV) {
            logger.debug('[DIAGNOSTIC] analyticsManager.initializeStudentAnalytics done');
          }
        } catch (err) {
          logger.error('[SAFE] analyticsManager.initializeStudentAnalytics failed', { error: err, studentId });
        }
      }
    } catch (err) {
      // Extra safety net; never rethrow from analytics side-effect
      logger.error('[SAFE] analyticsManager outer try/catch caught error', { error: err });
    }

    return () => {
      // On cleanup, abort any pending operations to prevent memory leaks and state updates on unmounted components.
      if (import.meta.env.DEV) {
        logger.debug('[DIAGNOSTIC] StudentProfile cleanup: aborting controller and clearing timers if any');
      }
      controller.abort();
    };
  }, [filteredData, getInsights, student, studentId]);

  /**
   * Handles the export of student data in various formats (PDF, CSV, JSON).
   * Wrapped in `useCallback` to ensure the function reference is stable across re-renders,
   * preventing unnecessary re-renders of child components that might receive it as a prop.
   */
  const handleExportData = useCallback(async (format: 'pdf' | 'csv' | 'json') => {
    if (!student) return;

    try {
      const baseFilename = `${student.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}`;
      let blob: Blob;
      let filename: string;

      const exportOptions = {
        trackingEntries: filteredData.entries,
        emotions: filteredData.emotions,
        sensoryInputs: filteredData.sensoryInputs,
        goals,
      };

      switch (format) {
        case 'pdf': {
          blob = await exportSystem.generatePDFReport(student, exportOptions, {
            format: 'pdf',
            includeFields: ['all'],
            includeCharts: true,
          });
          // Note: generatePDFReport currently returns an HTML document for printing.
          // Use .html extension to avoid browsers trying to open it as a PDF.
          filename = `${baseFilename}_report.html`;
          break;
        }
        case 'csv': {
          const csvContent = exportSystem.generateCSVExport([student], exportOptions, {
            format: 'csv',
            includeFields: ['all'],
          });
          blob = new Blob([csvContent], { type: 'text/csv' });
          filename = `${baseFilename}_data.csv`;
          break;
        }
        case 'json': {
          const jsonContent = exportSystem.generateJSONExport([student], exportOptions, {
            format: 'json',
            includeFields: ['students', 'trackingEntries', 'emotions', 'sensoryInputs', 'goals'],
          });
          blob = new Blob([jsonContent], { type: 'application/json' });
          filename = `${baseFilename}_data.json`;
          break;
        }
      }
      
      downloadBlob(blob, filename);
      toast.success(`Data exported successfully as ${format.toUpperCase()}`);
    } catch (error: unknown) {
      logger.error('Export error', { error });
      const errorMessage = error instanceof Error ? error.message : 'Please try again.';
      toast.error(`Export failed: ${errorMessage}`);
    }
  }, [student, filteredData, goals]);
  
  /**
   * Creates and triggers the download of a full backup of the student's data.
   * Wrapped in `useCallback` for performance optimization.
   */
  const handleBackupData = useCallback(async () => {
    if (!student) return;
    try {
      const backup = exportSystem.createFullBackup([student], {
        trackingEntries,
        emotions: allEmotions,
        sensoryInputs: allSensoryInputs,
        goals,
      });
      const backupBlob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const filename = `sensory_tracker_backup_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
      downloadBlob(backupBlob, filename);
      toast.success('Backup created successfully');
    } catch (error) {
      logger.error('Backup error', { error });
      toast.error('Backup failed. Please try again.');
    }
  }, [student, trackingEntries, allEmotions, allSensoryInputs, goals]);

  /**
   * Callback executed after mock data has been loaded.
   * This function calls `reloadData` from the `useStudentData` hook to refresh the UI
   * without requiring a full page reload, providing a smoother user experience.
   */

  // Consolidated early returns to avoid duplication
  if (isLoadingStudent) {
    return (
      <div className={fullScreenCenterCls}>
        <div className={rowGap2Cls}>
          <Loader className={loaderIconCls} />
          <p className={textMutedCls}>{t('loading_student_data')}</p>
        </div>
      </div>
    );
  }

  if (!student) {
    return (
      <div className={fullScreenCenterCls}>
        <div className={rowGap2Cls}>
          <p className={textDestructiveCls}>{t('student_not_found')}</p>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <div className={pageRootCls}>
        <StudentProfileSidebar
          student={student}
          activeSection={activeSection}
          onSectionChange={handleSectionChange}
        />
        <main className={mainCls}>
          <header className={headerCls}>
            <div className={headerInnerCls}>
              <div className={flexGap3Cls}>
                <SidebarTrigger />
                <Button variant={BTN_VARIANT_GHOST} size={BTN_SIZE_SM} onClick={() => navigate('/')} aria-label={tCommon('aria.go_back_to_dashboard')}>
                  <ArrowLeft className={iconSmCls} />
                  {String(tCommon('buttons.back'))}
                </Button>
              </div>
              <div className={flexGap3Cls}>
                <GlobalMenu />
                <LanguageSettings />
              </div>
            </div>
          </header>
          <div className={containerPaddingCls}>
            <ErrorBoundary>
              {/* 
                The main content is rendered conditionally based on the `activeSection` state.
                This declarative approach is more efficient and readable than the previous `useMemo` block.
                Each section is a memoized component, ensuring it only re-renders when its specific props change.
              */}
              {activeSection === 'dashboard' && (
                <MemoizedDashboardSection
                  student={student}
                  trackingEntries={trackingEntries}
                  filteredData={filteredData}
                  selectedRange={selectedRange}
                  onRangeChange={handleRangeChange}
                  insights={insights}
                  isLoadingInsights={isLoadingInsights}
                />
              )}
              {activeSection === 'analytics' && (
                <ErrorBoundary showToast={true}>
                  <MemoizedAnalyticsSection
                    student={student}
                    trackingEntries={trackingEntries ?? []}
                    filteredData={filteredData}
                    insights={insights}
                    isLoadingInsights={isLoadingInsights}
                  />
                </ErrorBoundary>
              )}
              {activeSection === 'goals' && (
                <div className={spaceY6Cls}>
                  <div>
                    <h2 className={titleCls}>{t('goals_title')}</h2>
                    <p className={textMutedCls}>
                      {t('goals_description', { name: student.name })}
                    </p>
                  </div>
                  <MemoizedGoalManager student={student} onGoalUpdate={reloadGoals} />
                </div>
              )}
              {activeSection === 'progress' && (
                 <div className={spaceY6Cls}>
                   <div>
                     <h2 className={titleCls}>{t('progress_title')}</h2>
                     <p className={textMutedCls}>
                       {t('progress_description', { name: student.name })}
                     </p>
                   </div>
                   <MemoizedProgressDashboard student={student} goals={goals} />
                 </div>
              )}
              {activeSection === 'reports' && (
                <div className={spaceY6Cls}>
                  <div>
                    <h2 className={titleCls}>{t('reports_title')}</h2>
                    <p className={textMutedCls}>
                      {t('reports_description', { name: student.name })}
                    </p>
                  </div>
                  <div className={reportsActionsCls}>
                    <Button variant={BTN_VARIANT_OUTLINE} onClick={() => handleExportData('pdf')}>
                      <FileText className={iconSmCls} />{t('export_pdf')}
                    </Button>
                    <Button variant={BTN_VARIANT_OUTLINE} onClick={() => handleExportData('csv')}>
                      <Calendar className={iconSmCls} />{t('export_csv')}
                    </Button>
                    <Button variant={BTN_VARIANT_OUTLINE} onClick={() => handleExportData('json')}>
                      <Download className={iconSmCls} />{t('export_json')}
                    </Button>
                    <Button variant={BTN_VARIANT_OUTLINE} onClick={handleBackupData}>
                      <Save className={iconSmCls} />{t('create_backup')}
                    </Button>
                  </div>
                  <ErrorBoundary>
                    <MemoizedLazyReportBuilder
                      student={student}
                      goals={goals}
                      trackingEntries={filteredData.entries}
                      emotions={filteredData.emotions}
                      sensoryInputs={filteredData.sensoryInputs}
                    />
                  </ErrorBoundary>
                </div>
              )}
              {(activeSection === 'search' || activeSection === 'templates' || activeSection === 'compare') && (
                 <MemoizedToolsSection
                    student={student}
                    trackingEntries={trackingEntries}
                    emotions={allEmotions}
                    sensoryInputs={allSensoryInputs}
                    goals={goals}
                    activeToolSection={activeSection}
                    onToolSectionChange={setActiveSection}
                    onSearchResults={() => {}} // This should be properly handled if search is a feature
                  />
              )}
              {activeSection === 'enhanced-tracking' && (
                  <div className={spaceY6Cls}>
                    <div>
                      <h2 className={titleCls}>{t('enhanced_tracking_title')}</h2>
                      <p className={textMutedCls}>
                        {t('enhanced_tracking_description', { name: student.name })}
                      </p>
                    </div>
                    <div className={centerMutedCls}>
                      <p>{t('enhanced_tracking_coming_soon')}</p>
                    </div>
                  </div>
              )}
            </ErrorBoundary>
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
};

export { StudentProfile };
