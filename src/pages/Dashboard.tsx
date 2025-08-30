import { useState, useEffect, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Student, TrackingEntry } from "@/types/student";
import { useNavigate } from "react-router-dom";
import { isToday } from "date-fns";
import { useTranslation } from "@/hooks/useTranslation";
import { AnimatedCounter } from "@/components/AnimatedCounter";
import { LanguageSettings } from "@/components/LanguageSettings";
import { POCBadge } from "@/components/POCBadge";
import { POC_MODE, IS_PROD } from "@/lib/env";
import { PremiumStudentCard } from "@/components/ui/PremiumStudentCard";
import { MockDataLoader } from "@/components/MockDataLoader";
import { dataStorage } from "@/lib/dataStorage";
import { FlaskConical, HelpCircle, Download, Plus, Users, CalendarDays, BarChart3, TrendingUp, TrendingDown, Hand } from "lucide-react";
import { HelpAndSupport } from "@/components/HelpAndSupport";
import { GlobalMenu } from "@/components/GlobalMenu";
import { subWeeks, startOfWeek, endOfWeek, isWithinInterval } from 'date-fns';
import { logger } from "@/lib/logger";
import { cn } from "@/lib/utils";

/**
 * Dashboard component - Main landing page with modern glassmorphism design
 * @returns React component displaying students list and tracking statistics
 */
const Dashboard = () => {
  const [students, setStudents] = useState<Student[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();
  const { tDashboard, tCommon, tSettings } = useTranslation();

  useEffect(() => {
    const loadData = () => {
      try {
        const students = dataStorage.getStudents();
        setStudents(students);
      } catch (error) {
        logger.error('Dashboard: Error loading students', { error });
        setStudents([]);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
    
    // Listen for storage changes to refresh data without page reload
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key?.startsWith('sensoryTracker_')) {
        
        loadData();
      }
    };

    /**
     * Handles the 'mockDataLoaded' event dispatched from the MockDataLoader component.
     * This ensures the dashboard's data is refreshed when mock data is loaded.
     */
    const handleMockDataLoaded = () => {
      loadData();
    }
    
window.addEventListener('storage', handleStorageChange);
    logger.debug('[EVENT_LISTENER] Added storage listener');
    
    // The 'mockDataLoaded' event is a custom event dispatched from the MockDataLoader component.
    window.addEventListener('mockDataLoaded', handleMockDataLoaded);
    logger.debug('[EVENT_LISTENER] Added mockDataLoaded listener');
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      logger.debug('[EVENT_LISTENER] Removed storage listener');
      
      window.removeEventListener('mockDataLoaded', handleMockDataLoaded);
      logger.debug('[EVENT_LISTENER] Removed mockDataLoaded listener');
    };
  }, []);

  /**
   * Calculate statistics from all tracking data, including weekly trends.
   * This memoized calculation avoids re-computing on every render.
   */
  const { todayEntries, totalEntries, weeklyTrend } = useMemo(() => {
    if (students.length === 0) {
      return { todayEntries: 0, totalEntries: 0, weeklyTrend: { students: 0, entries: 0 } };
    }

    try {
      const allEntries = dataStorage.getTrackingEntries();
      const todayCount = allEntries.filter(entry => isToday(entry.timestamp)).length;

      const now = new Date();
      const lastWeekStart = startOfWeek(subWeeks(now, 1));
      const lastWeekEnd = endOfWeek(subWeeks(now, 1));
      const thisWeekStart = startOfWeek(now);

      const lastWeekEntries = allEntries.filter(entry => isWithinInterval(entry.timestamp, { start: lastWeekStart, end: lastWeekEnd })).length;
      const thisWeekEntries = allEntries.filter(entry => isWithinInterval(entry.timestamp, { start: thisWeekStart, end: now })).length;

      const entriesTrend = lastWeekEntries > 0 ? ((thisWeekEntries - lastWeekEntries) / lastWeekEntries) * 100 : thisWeekEntries > 0 ? 100 : 0;

      const lastWeekStudents = students.filter(s => isWithinInterval(new Date(s.createdAt), { start: lastWeekStart, end: lastWeekEnd })).length;
      const thisWeekStudents = students.filter(s => isWithinInterval(new Date(s.createdAt), { start: thisWeekStart, end: now })).length;
      const studentsTrend = lastWeekStudents > 0 ? ((thisWeekStudents - lastWeekStudents) / lastWeekStudents) * 100 : thisWeekStudents > 0 ? 100 : 0;
      
      return { 
        todayEntries: todayCount,
        totalEntries: allEntries.length,
        weeklyTrend: {
          students: studentsTrend,
          entries: entriesTrend
        }
      };
    } catch (error) {
      logger.error('Dashboard: Error calculating statistics', { error });
      return { todayEntries: 0, totalEntries: 0, weeklyTrend: { students: 0, entries: 0 } };
    }
  }, [students]);

  const handleAddStudent = () => {
    navigate('/add-student');
  };

  const handleNewEntry = () => {
    if (students.length > 0) {
      navigate(`/track/${students[0].id}`);
    } else {
      navigate('/add-student');
    }
  };

  // Removed system-wide export from Dashboard. A dedicated Reports page now handles exports.

  const handleViewStudent = (student: Student) => {
    navigate(`/student/${student.id}`);
  };

  const handleTrackStudent = (student: Student) => {
    navigate(`/track/${student.id}`);
  };

  return (
    <div className="main-container min-h-screen relative">
      {/* Animated glow background */}
      <div className="glow-bg"></div>
      
      <div className="relative z-10 min-h-screen px-4 py-8 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          
          {/* Enhanced Header with Gradient and Animations */}
          <header className="relative mb-16 overflow-hidden">
            {/* Decorative background elements */}
            <div className="absolute inset-0 -z-10">
              <div className="absolute top-0 -left-4 w-72 h-72 bg-purple-300 rounded-full mix-blend-multiply filter blur-xl opacity-10 motion-safe:animate-blob"></div>
              <div className="absolute top-0 -right-4 w-72 h-72 bg-yellow-300 rounded-full mix-blend-multiply filter blur-xl opacity-10 motion-safe:animate-blob animation-delay-2000"></div>
              <div className="absolute -bottom-8 left-20 w-72 h-72 bg-pink-300 rounded-full mix-blend-multiply filter blur-xl opacity-10 motion-safe:animate-blob animation-delay-4000"></div>
            </div>
            
            <div className="relative glass-card rounded-2xl p-8 shadow-2xl backdrop-blur-xl border border-primary/20">
              <div className="flex justify-between items-center">
                <div className="space-y-4">
                  {/* Animated title with gradient */}
                  <div className="flex items-center gap-4">
                    <div className="relative">
                      <div className="absolute inset-0 bg-gradient-to-r from-primary via-purple-500 to-pink-500 rounded-2xl blur-xl opacity-50 motion-safe:animate-pulse"></div>
                      <div className="relative bg-gradient-to-br from-primary/20 to-purple-500/20 p-4 rounded-2xl border border-primary/30 group">
                        <div className="text-3xl font-bold text-white motion-safe:group-hover:animate-bounce-slow">K</div>
                      </div>
                    </div>
                    <div>
                      <h1 className="text-5xl lg:text-6xl font-black bg-gradient-to-r from-white via-primary-foreground to-purple-200 bg-clip-text text-transparent motion-safe:animate-gradient-x">
                        {String(tDashboard('title'))}
                      </h1>
                      <div className="flex items-center gap-2 mt-2">
                        <div className="h-0.5 w-8 bg-gradient-to-r from-primary to-purple-500 rounded-full"></div>
                        <div className="h-0.5 w-4 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full"></div>
                        <div className="h-0.5 w-2 bg-pink-500 rounded-full"></div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Subtitle with elegant styling */}
                  <p className="text-lg lg:text-xl text-muted-foreground/90 font-light tracking-wide max-w-2xl leading-relaxed">
                    {String(tDashboard('subtitle'))}
                  </p>
                  
                  {/* Stats pills */}
                  <div className="flex flex-wrap gap-3 pt-2">
                    <div className="px-4 py-2 bg-primary/10 rounded-full border border-primary/20 backdrop-blur-sm">
                      <span className="text-xs font-medium text-primary">{students.length} {String(tDashboard('pills.students'))}</span>
                    </div>
                    <div className="px-4 py-2 bg-purple-500/10 rounded-full border border-purple-500/20 backdrop-blur-sm">
                      <span className="text-xs font-medium text-primary-foreground/80">{todayEntries} {String(tDashboard('pills.today'))}</span>
                      <span className="text-xs font-medium text-primary-foreground/80">{totalEntries} {String(tDashboard('pills.total'))}</span>
                    </div>
                    <div className="px-4 py-2 bg-pink-500/10 rounded-full border border-pink-500/20 backdrop-blur-sm">
                      <span className="text-xs font-medium text-pink-400">{totalEntries} {String(tDashboard('pills.total'))}</span>
                    </div>
                  </div>
                </div>
                
                {/* Action buttons with glassmorphism */}
                <div className="flex items-center gap-3">
                  {POC_MODE && <POCBadge />}
                  
                  <div className="flex items-center gap-2" role="toolbar" aria-label={tCommon('a11y.headerControls')}>
                    <GlobalMenu />
                    <HelpAndSupport />
                    <LanguageSettings />
                  </div>
                </div>
              </div>
            </div>
            </header>

            <main>
              {/* Overview section with buttons */}
              <div 
                className="flex justify-between items-center mb-8 motion-safe:animate-fade-in" 
                data-animation-delay="0.2s"
              >
                <h2 className="text-3xl font-bold tracking-tight text-foreground">{String(tDashboard('overview.title'))}</h2>
                <div className="flex items-center space-x-4">
                  <Button 
                    variant="outline" 
                    onClick={() => navigate('/reports')}
                    className="flex items-center justify-center group"
                    aria-label={tSettings('data.export')}
                    data-testid="dashboard-export-link"
                  >
                    <Download className="mr-2 h-4 w-4" />
                    {String(tSettings('data.export'))}
                  </Button>
                  <Button
                    variant="glass"
                    size="lg"
                    onClick={() => navigate('/tegn')}
                    className="flex items-center justify-center group"
                    aria-label={tCommon('navigation.tegnTilTale')}
                    data-testid="dashboard-tegn-button"
                  >
                    <Hand className="mr-2 h-4 w-4" />
                    {String(tCommon('navigation.tegnTilTale'))}
                  </Button>
                  <Button 
                    variant="default" 
                    onClick={handleNewEntry}
                    size="lg"
                    className="flex items-center justify-center group"
                  >
                    <Plus className="mr-2 h-4 w-4 group-hover:animate-bounce" />
                    {String(tDashboard('actions.newEntry'))}
                  </Button>
                </div>
              </div>

              {/* Stats cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
                  <Card 
                  className="motion-safe:animate-fade-in" 
                  data-animation-delay="0.3s"
                >
                  <div className="flex justify-between items-start">
                    <h3 className="text-lg font-medium text-muted-foreground">
                      {String(tDashboard('stats.totalStudents'))}
                    </h3>
                    <div className="icon-bg p-2 rounded-lg">
                      <Users className="text-primary h-5 w-5" />
                    </div>
                  </div>
                  <p className="text-5xl font-bold mt-6 text-foreground motion-safe:animate-number-pop" data-animation-delay="0.4s">
                    <AnimatedCounter value={isLoading ? 0 : students.length} />
                  </p>
                  <div className="flex items-center text-sm mt-3">
                    {weeklyTrend.students >= 0 ? <TrendingUp className="text-success h-4 w-4 mr-1" /> : <TrendingDown className="text-destructive h-4 w-4 mr-1" />}
                    <span className={cn(weeklyTrend.students >= 0 ? "text-success" : "text-destructive")}>{Math.abs(weeklyTrend.students).toFixed(0)}%</span>
                    <span className="ml-1 text-muted-foreground">{String(tDashboard('stats.fromLastWeek'))}</span>
                  </div>
                </Card>

                <Card 
                  className="motion-safe:animate-fade-in" 
                  data-animation-delay="0.4s"
                >
                  <div className="flex justify-between items-start">
                    <h3 className="text-lg font-medium text-muted-foreground">
                      {String(tDashboard('stats.todaysEntries'))}
                    </h3>
                    <div className="icon-bg p-2 rounded-lg">
                      <CalendarDays className="text-primary h-5 w-5" />
                    </div>
                  </div>
                  <p className="text-5xl font-bold mt-6 text-foreground motion-safe:animate-number-pop" data-animation-delay="0.5s">
                    <AnimatedCounter value={isLoading ? 0 : todayEntries} />
                  </p>
                  <div className="flex items-center text-sm mt-3">
                    {weeklyTrend.entries >= 0 ? <TrendingUp className="text-success h-4 w-4 mr-1" /> : <TrendingDown className="text-destructive h-4 w-4 mr-1" />}
                    <span className={cn(weeklyTrend.entries >= 0 ? "text-success" : "text-destructive")}>{Math.abs(weeklyTrend.entries).toFixed(0)}%</span>
                    <span className="ml-1 text-muted-foreground">{String(tDashboard('stats.fromLastWeek'))}</span>
                  </div>
                </Card>

                <Card 
                  className="motion-safe:animate-fade-in" 
                  data-animation-delay="0.5s"
                >
                  <div className="flex justify-between items-start">
                    <h3 className="text-lg font-medium text-muted-foreground">
                      {String(tDashboard('stats.totalEntries'))}
                    </h3>
                    <div className="icon-bg p-2 rounded-lg">
                      <BarChart3 className="text-primary h-5 w-5" />
                    </div>
                  </div>
                  <p className="text-5xl font-bold mt-6 text-foreground motion-safe:animate-number-pop" data-animation-delay="0.6s">
                    <AnimatedCounter value={isLoading ? 0 : totalEntries} />
                  </p>
                  <div className="flex items-center text-sm mt-3">
                    <TrendingDown className="text-destructive h-4 w-4 mr-1" />
                    <span className="text-destructive">5%</span>
                    <span className="ml-1 text-muted-foreground">from last week</span>
                  </div>
                </Card>
              </div>

              {/* Students section */}
              <div>
                <div 
                  className="flex justify-between items-center mb-8 text-foreground motion-safe:animate-fade-in" 
                  data-animation-delay="0.6s"
                >
                  <h2 className="text-3xl font-bold tracking-tight">{String(tDashboard('students.title'))}</h2>
                  <Button 
                    variant="default" 
                    onClick={handleAddStudent}
                    size="lg"
                    className="flex items-center justify-center group"
                  >
                    <Plus className="mr-2 h-4 w-4 group-hover:animate-bounce transition-transform" />
                    {String(tDashboard('actions.addStudent'))}
                  </Button>
                </div>

                {/* Students grid or empty state */}
                {isLoading ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 motion-safe:animate-fade-in" data-animation-delay="0.7s">
                    {[...Array(3)].map((_, i) => (
                      <div key={i} className="glass-card rounded-3xl p-6 animate-pulse">
                        <div className="flex items-start gap-4 mb-4">
                          <div className="w-12 h-12 bg-muted/50 rounded-full"></div>
                          <div className="flex-1">
                            <div className="h-5 bg-muted/50 rounded mb-2"></div>
                            <div className="h-4 bg-muted/30 rounded w-2/3"></div>
                          </div>
                        </div>
                        <div className="h-2 bg-muted/30 rounded mb-4"></div>
                        <div className="grid grid-cols-2 gap-4 mb-4">
                          <div className="h-12 bg-muted/30 rounded"></div>
                          <div className="h-12 bg-muted/30 rounded"></div>
                        </div>
                        <div className="flex gap-2">
                          <div className="h-8 bg-muted/30 rounded flex-1"></div>
                          <div className="h-8 bg-muted/30 rounded flex-1"></div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : students.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-fade-in" data-animation-delay="0.7s">
                    {students.map((student, index) => (
                      <PremiumStudentCard
                        key={student.id}
                        student={student}
                        onView={handleViewStudent}
                        onTrack={handleTrackStudent}
                        index={index}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="space-y-8 animate-fade-in" data-animation-delay="0.7s">
                    {/* Empty State */}
                    <div className="relative glass-card rounded-3xl p-8 text-center min-h-[400px] flex flex-col justify-center items-center overflow-hidden">
                      {/* Decorative SVG elements */}
                      <div className="absolute top-10 right-10 opacity-10 transition-transform duration-500 hover:scale-110">
                        <svg fill="none" height="100" viewBox="0 0 24 24" width="100" xmlns="http://www.w3.org/2000/svg">
                          <path d="M16.5 12C16.5 14.4853 14.4853 16.5 12 16.5C9.51472 16.5 7.5 14.4853 7.5 12C7.5 9.51472 9.51472 7.5 12 7.5C14.4853 7.5 16.5 9.51472 16.5 12Z" stroke="hsl(var(--primary))" strokeWidth="1.5"></path>
                          <path d="M19.5 17.5714C19.5 19.961 17.2687 21.5 15.4286 21.5C13.5884 21.5 11.8333 20.3571 10.7143 19.2857M4.5 17.5714C4.5 19.961 6.73134 21.5 8.57143 21.5C10.4116 21.5 12.1667 20.3571 13.2857 19.2857M13.2857 19.2857C14.0714 18.5 14.0714 17.2143 13.2857 16.4286M10.7143 19.2857C9.92857 18.5 9.92857 17.2143 10.7143 16.4286M13.2857 16.4286C12.5 15.6429 11.5 15.6429 10.7143 16.4286M12 7.5C10.7143 4.5 8.57143 2.5 6 2.5M12 7.5C13.2857 4.5 15.4286 2.5 18 2.5" stroke="hsl(var(--primary))" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"></path>
                        </svg>
                      </div>
                      
                      <div className="absolute bottom-10 left-10 opacity-5 -rotate-12 transition-transform duration-500 hover:scale-110 hover:-rotate-6">
                        <svg fill="none" height="120" viewBox="0 0 24 24" width="120" xmlns="http://www.w3.org/2000/svg">
                          <path d="M16.5 12C16.5 14.4853 14.4853 16.5 12 16.5C9.51472 16.5 7.5 14.4853 7.5 12C7.5 9.51472 9.51472 7.5 12 7.5C14.4853 7.5 16.5 9.51472 16.5 12Z" stroke="hsl(var(--primary))" strokeWidth="1.5"></path>
                          <path d="M19.5 17.5714C19.5 19.961 17.2687 21.5 15.4286 21.5C13.5884 21.5 11.8333 20.3571 10.7143 19.2857M4.5 17.5714C4.5 19.961 6.73134 21.5 8.57143 21.5C10.4116 21.5 12.1667 20.3571 13.2857 19.2857M13.2857 19.2857C14.0714 18.5 14.0714 17.2143 13.2857 16.4286M10.7143 19.2857C9.92857 18.5 9.92857 17.2143 10.7143 16.4286M13.2857 16.4286C12.5 15.6429 11.5 15.6429 10.7143 16.4286M12 7.5C10.7143 4.5 8.57143 2.5 6 2.5M12 7.5C13.2857 4.5 15.4286 2.5 18 2.5" stroke="hsl(var(--primary))" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"></path>
                        </svg>
                      </div>

                      <div className="relative z-10 flex flex-col items-center">
                        <div className="flex items-center justify-center w-24 h-24 bg-primary/10 rounded-full mb-6 border border-primary/20 transition-transform duration-300 hover:scale-110">
                          <Users className="text-primary h-12 w-12 transition-transform duration-300 group-hover:rotate-6" />
                        </div>
                        <h3 className="text-2xl font-semibold text-foreground">
                          {String(tDashboard('empty.welcome'))}
                        </h3>
                        <p className="mt-3 max-w-md text-base text-muted-foreground">
                          {String(tDashboard('empty.description'))}
                        </p>
                        <Button 
                          variant="default" 
                          onClick={handleAddStudent}
                          size="lg"
                          className="mt-8 flex items-center justify-center group"
                        >
                          <Plus className="mr-2 h-4 w-4 group-hover:animate-bounce transition-transform" />
                          {String(tDashboard('empty.addFirstStudent'))}
                        </Button>
                      </div>
                    </div>

                    {/*
                      The MockDataLoader component is displayed in the empty state to help users
                      get started with some sample data for testing and exploration.
                    */}
                    {(!IS_PROD || POC_MODE) && (
                      <Card className="mt-8 bg-gradient-card border-0 shadow-soft">
                        <CardContent className="p-6">
                          <div className="text-center mb-4">
                            <h4 className="text-lg font-semibold text-foreground">{String(tDashboard('empty.sample.title'))}</h4>
                            <p className="text-sm text-muted-foreground mt-1">
                              {String(tDashboard('empty.sample.description'))}
                            </p>
                          </div>
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button variant="outline" className="w-full">
                                <FlaskConical className="h-4 w-4 mr-2" />
                                {String(tDashboard('empty.sample.loadButton'))}
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-2xl">
                              <DialogHeader>
                                <DialogTitle>{String(tDashboard('empty.sample.dialogTitle'))}</DialogTitle>
                                <DialogDescription>
                                  {String(tDashboard('empty.sample.dialogDescription'))}
                                </DialogDescription>
                              </DialogHeader>
                              <MockDataLoader />
                            </DialogContent>
                          </Dialog>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                )}
              </div>
            </main>
          </div>
        </div>
      </div>
  );
};

export { Dashboard };
