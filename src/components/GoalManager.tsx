/**
 * @fileoverview GoalManager - Comprehensive goal tracking and management system
 * 
 * Provides functionality for creating, tracking, and managing student IEP goals.
 * Supports milestones, progress tracking, and various goal categories.
 * 
 * @module components/GoalManager
 */

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Goal, Student, GoalDataPoint, Milestone } from "@/types/student";
import { dataStorage } from "@/lib/dataStorage";
import { Calendar, Plus, Crosshair, TrendingUp, CheckCircle, Edit, Trash2, Calendar as CalendarIcon } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { logger } from "@/lib/logger";

interface GoalManagerProps {
  student: Student;
  onGoalUpdate?: () => void;
}

/**
 * GoalManager Component
 * 
 * Manages IEP goals for a specific student, including creation, tracking,
 * progress monitoring, and milestone management.
 * 
 * @component
 * @param {GoalManagerProps} props - Component props
 * @param {Student} props.student - The student whose goals are being managed
 * @param {Function} [props.onGoalUpdate] - Callback when goals are updated
 */
export const GoalManager = ({ student, onGoalUpdate }: GoalManagerProps) => {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [newGoal, setNewGoal] = useState({
    title: "",
    description: "",
    category: "behavioral" as Goal['category'],
    measurableObjective: "",
    targetDate: "",
    targetValue: 100,
    baselineValue: 0
  });

  /**
   * Load goals for the current student.
   * Memoized to prevent recreation on every render.
   */
  const loadGoals = useCallback(() => {
    const allGoals = dataStorage.getGoals();
    const studentGoals = allGoals.filter(goal => goal.studentId === student.id);
    setGoals(studentGoals);
  }, [student.id]);

  /**
   * Effect to load goals when student changes.
   */
  useEffect(() => {
    loadGoals();
  }, [loadGoals]);

  /**
   * Generate a unique ID using crypto.randomUUID or fallback.
   * This is more secure and collision-resistant than Math.random().
   * 
   * @returns {string} A unique identifier
   */
  const generateId = (): string => {
    // Use crypto.randomUUID if available (modern browsers)
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    
    // Fallback to timestamp + random for older browsers
    // This is still much better than Math.random().toString(36)
    const timestamp = Date.now().toString(36);
    const randomPart = Math.random().toString(36).substring(2, 11);
    const randomPart2 = Math.random().toString(36).substring(2, 11);
    return `${timestamp}-${randomPart}-${randomPart2}`;
  };

  const createGoal = () => {
    // Validate required fields
    if (!newGoal.title.trim() || !newGoal.description.trim() || !newGoal.measurableObjective.trim()) {
      toast.error("Please fill in all required fields");
      return;
    }

    // Validate target date
    if (!newGoal.targetDate) {
      toast.error("Please select a target date");
      return;
    }

    const targetDate = new Date(newGoal.targetDate);
    if (isNaN(targetDate.getTime())) {
      toast.error("Invalid target date");
      return;
    }

    // Ensure target date is in the future
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (targetDate < today) {
      toast.error("Target date must be in the future");
      return;
    }

    // Validate baseline and target values
    if (newGoal.targetValue <= newGoal.baselineValue) {
      toast.error("Target value must be greater than baseline value");
      return;
    }

    const goal: Goal = {
      id: generateId(),
      studentId: student.id,
      title: newGoal.title,
      description: newGoal.description,
      category: newGoal.category,
      targetDate,
      createdDate: new Date(),
      status: "active",
      measurableObjective: newGoal.measurableObjective,
      currentProgress: 0,
      milestones: [],
      interventions: [],
      baselineValue: newGoal.baselineValue,
      targetValue: newGoal.targetValue,
      dataPoints: [{
        id: generateId(),
        timestamp: new Date(),
        value: newGoal.baselineValue,
        notes: "Baseline measurement",
        collectedBy: "Teacher"
      }]
    };

    dataStorage.saveGoal(goal);
    loadGoals();
    resetForm();
    setShowCreateDialog(false);
    toast.success("Goal created successfully!");
    onGoalUpdate?.();
  };

  const updateGoal = (goalId: string, updates: Partial<Goal>) => {
    const goalToUpdate = goals.find(g => g.id === goalId);
    if (!goalToUpdate) return;

    const updatedGoal = { ...goalToUpdate, ...updates };
    dataStorage.saveGoal(updatedGoal);
    loadGoals();
    onGoalUpdate?.();
  };

  const addDataPoint = (goalId: string, value: number, notes?: string) => {
    const goal = goals.find(g => g.id === goalId);
    if (!goal) return;

    const newDataPoint: GoalDataPoint = {
      id: generateId(),
      timestamp: new Date(),
      value,
      notes,
      collectedBy: "Teacher"
    };

    const updatedDataPoints = [...goal.dataPoints, newDataPoint];
    const progress = goal.targetValue ? ((value - (goal.baselineValue || 0)) / (goal.targetValue - (goal.baselineValue || 0))) * 100 : 0;
    
    updateGoal(goalId, {
      dataPoints: updatedDataPoints,
      currentProgress: Math.max(0, Math.min(100, progress))
    });

    toast.success("Progress updated!");
  };

  const addMilestone = (goalId: string, title: string, description: string, targetDate: Date) => {
    const goal = goals.find(g => g.id === goalId);
    if (!goal) return;

    const newMilestone: Milestone = {
      id: generateId(),
      title,
      description,
      targetDate,
      isCompleted: false
    };

    updateGoal(goalId, {
      milestones: [...goal.milestones, newMilestone]
    });

    toast.success("Milestone added!");
  };

  const completeMilestone = (goalId: string, milestoneId: string) => {
    const goal = goals.find(g => g.id === goalId);
    if (!goal) return;

    const updatedMilestones = goal.milestones.map(m =>
      m.id === milestoneId 
        ? { ...m, isCompleted: true, completedDate: new Date() }
        : m
    );

    updateGoal(goalId, { milestones: updatedMilestones });
    toast.success("Milestone completed! 🎉");
  };

  /**
   * Delete a goal with proper confirmation and efficient storage update.
   * 
   * @param {string} goalId - ID of the goal to delete
   */
  const deleteGoal = (goalId: string) => {
    const goal = goals.find(g => g.id === goalId);
    if (!goal) {
      logger.warn('Attempted to delete non-existent goal', { goalId });
      return;
    }

    try {
      const confirmed = window.confirm(`Are you sure you want to delete the goal "${goal.title}"?`);
      if (confirmed) {
        // More efficient deletion: mark as deleted instead of rewriting all goals
        const updatedGoal = { ...goal, status: 'discontinued' as Goal['status'], deletedAt: new Date() };
        dataStorage.saveGoal(updatedGoal);
        loadGoals();
        toast.success("Goal deleted");
        onGoalUpdate?.();
      }
    } catch (error) {
      logger.error('Failed to delete goal', error);
      toast.error('Failed to delete goal. Please try again.');
    }
  };

  const resetForm = () => {
    setNewGoal({
      title: "",
      description: "",
      category: "behavioral",
      measurableObjective: "",
      targetDate: "",
      targetValue: 100,
      baselineValue: 0
    });
    setEditingGoal(null);
  };

  const getStatusColor = (status: Goal['status']) => {
    switch (status) {
      case 'active': return 'bg-blue-500';
      case 'achieved': return 'bg-green-500';
      case 'modified': return 'bg-yellow-500';
      case 'discontinued': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getCategoryIcon = (category: Goal['category']) => {
    switch (category) {
      case 'behavioral': return '🎯';
      case 'academic': return '📚';
      case 'social': return '👥';
      case 'sensory': return '🎨';
      case 'communication': return '💬';
      default: return '📋';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">IEP Goals</h2>
          <p className="text-muted-foreground">Track and monitor {student.name}'s progress toward educational objectives</p>
        </div>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-primary hover:opacity-90 font-dyslexia">
              <Plus className="h-4 w-4 mr-2" />
              New Goal
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create New IEP Goal</DialogTitle>
              <DialogDescription>
                Enter goal details, targets, and measurable objectives.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="title">Goal Title *</Label>
                <Input
                  id="title"
                  value={newGoal.title}
                  onChange={(e) => setNewGoal(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="e.g., Improve emotional regulation during transitions"
                />
              </div>
              <div>
                <Label htmlFor="category">Category</Label>
                <Select value={newGoal.category} onValueChange={(value: Goal['category']) => setNewGoal(prev => ({ ...prev, category: value }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="behavioral">Behavioral</SelectItem>
                    <SelectItem value="academic">Academic</SelectItem>
                    <SelectItem value="social">Social</SelectItem>
                    <SelectItem value="sensory">Sensory</SelectItem>
                    <SelectItem value="communication">Communication</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="description">Description *</Label>
                <Textarea
                  id="description"
                  value={newGoal.description}
                  onChange={(e) => setNewGoal(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Detailed description of what the student will achieve..."
                />
              </div>
              <div>
                <Label htmlFor="measurable">Measurable Objective *</Label>
                <Textarea
                  id="measurable"
                  value={newGoal.measurableObjective}
                  onChange={(e) => setNewGoal(prev => ({ ...prev, measurableObjective: e.target.value }))}
                  placeholder="How will progress be measured? Include specific criteria..."
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="baseline">Baseline Value</Label>
                  <Input
                    id="baseline"
                    type="number"
                    value={newGoal.baselineValue}
                    onChange={(e) => setNewGoal(prev => ({ ...prev, baselineValue: Number(e.target.value) }))}
                  />
                </div>
                <div>
                  <Label htmlFor="target">Target Value</Label>
                  <Input
                    id="target"
                    type="number"
                    value={newGoal.targetValue}
                    onChange={(e) => setNewGoal(prev => ({ ...prev, targetValue: Number(e.target.value) }))}
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="targetDate">Target Date</Label>
                <Input
                  id="targetDate"
                  type="date"
                  value={newGoal.targetDate}
                  onChange={(e) => setNewGoal(prev => ({ ...prev, targetDate: e.target.value }))}
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => { resetForm(); setShowCreateDialog(false); }}>
                  Cancel
                </Button>
                <Button onClick={createGoal}>Create Goal</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Goals List */}
      {goals.length === 0 ? (
        <Card className="bg-gradient-card border-0 shadow-soft">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Crosshair className="h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold text-foreground mb-2">No IEP Goals Yet</h3>
            <p className="text-muted-foreground text-center mb-6 max-w-md">
              Start by creating your first IEP goal to track {student.name}'s educational progress.
            </p>
            <Button onClick={() => setShowCreateDialog(true)} className="bg-gradient-primary hover:opacity-90 font-dyslexia">
              <Plus className="h-4 w-4 mr-2" />
              Create First Goal
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6">
          {goals.map((goal) => (
            <Card key={goal.id} className="bg-gradient-card border-0 shadow-soft">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">{getCategoryIcon(goal.category)}</span>
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        {goal.title}
                        <Badge variant="outline" className={`${getStatusColor(goal.status)} text-white border-0`}>
                          {goal.status}
                        </Badge>
                      </CardTitle>
                      <p className="text-muted-foreground mt-1">{goal.description}</p>
                      <Badge variant="secondary" className="mt-2">
                        {goal.category}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="icon" aria-label="Edit goal" title="Edit goal">
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" aria-label="Delete goal" title="Delete goal" onClick={() => deleteGoal(goal.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {/* Progress */}
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Progress</span>
                    <span className="text-sm text-muted-foreground">{Math.round(goal.currentProgress)}%</span>
                  </div>
                  <Progress value={goal.currentProgress} className="h-3" />
                </div>

                {/* Measurable Objective */}
                <div className="mb-4">
                  <h4 className="font-medium mb-2">Measurable Objective</h4>
                  <p className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">
                    {goal.measurableObjective}
                  </p>
                </div>

                {/* Timeline */}
                <div className="flex items-center gap-4 mb-4">
                  <div className="flex items-center gap-2 text-sm">
                    <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                    <span>Created: {format(goal.createdDate, 'MMM dd, yyyy')}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Crosshair className="h-4 w-4 text-muted-foreground" />
                    <span>Target: {format(goal.targetDate, 'MMM dd, yyyy')}</span>
                  </div>
                </div>

                {/* Milestones */}
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium">Milestones</h4>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => {
                        const title = prompt("Milestone title:");
                        const description = prompt("Milestone description:");
                        const dateStr = prompt("Target date (YYYY-MM-DD):");
                        if (title && description && dateStr) {
                          addMilestone(goal.id, title, description, new Date(dateStr));
                        }
                      }}
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Add
                    </Button>
                  </div>
                  {goal.milestones.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No milestones yet</p>
                  ) : (
                    <div className="space-y-2">
                      {goal.milestones.map((milestone) => (
                        <div key={milestone.id} className="flex items-center gap-2 p-2 bg-muted/30 rounded">
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={milestone.isCompleted ? 'Milestone completed' : 'Mark milestone complete'}
                            title={milestone.isCompleted ? 'Milestone completed' : 'Mark milestone complete'}
                            onClick={() => !milestone.isCompleted && completeMilestone(goal.id, milestone.id)}
                            disabled={milestone.isCompleted}
                          >
                            <CheckCircle className={`h-4 w-4 ${milestone.isCompleted ? 'text-green-500' : 'text-muted-foreground'}`} />
                          </Button>
                          <div className="flex-1">
                            <p className={`text-sm ${milestone.isCompleted ? 'line-through text-muted-foreground' : ''}`}>
                              {milestone.title}
                            </p>
                            <p className="text-xs text-muted-foreground">{milestone.description}</p>
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {format(milestone.targetDate, 'MMM dd')}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Quick Progress Update */}
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const value = prompt("Enter current progress value:");
                      const notes = prompt("Progress notes (optional):");
                      if (value) {
                        addDataPoint(goal.id, Number(value), notes || undefined);
                      }
                    }}
                  >
                    <TrendingUp className="h-4 w-4 mr-1" />
                    Update Progress
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};