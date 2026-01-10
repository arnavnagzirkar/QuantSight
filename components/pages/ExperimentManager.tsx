import { useState } from 'react';
import { Plus, Play, Trash2, Copy, Edit, GitBranch, Calendar, TrendingUp } from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Card } from '../ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../ui/dialog';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';

interface Experiment {
  id: string;
  name: string;
  description: string;
  status: 'draft' | 'running' | 'completed' | 'failed';
  created: string;
  lastRun?: string;
  performance?: {
    sharpe: number;
    returns: number;
    drawdown: number;
  };
  config: {
    modelType: string;
    factors: string[];
    tickers: string[];
  };
}

const mockExperiments: Experiment[] = [
  {
    id: 'exp_1',
    name: 'Momentum + Value Strategy',
    description: 'Long-short strategy combining momentum and value factors',
    status: 'completed',
    created: '2024-11-15',
    lastRun: '2024-11-20',
    performance: {
      sharpe: 1.82,
      returns: 15.4,
      drawdown: -8.2,
    },
    config: {
      modelType: 'XGBoost',
      factors: ['momentum_12m', 'pe_ratio', 'pb_ratio'],
      tickers: ['SPY', 'QQQ', 'IWM'],
    },
  },
  {
    id: 'exp_2',
    name: 'Quality Factor Ensemble',
    description: 'Multi-factor model focusing on quality metrics',
    status: 'running',
    created: '2024-11-18',
    lastRun: '2024-11-22',
    performance: {
      sharpe: 1.65,
      returns: 12.8,
      drawdown: -6.5,
    },
    config: {
      modelType: 'XGBoost',
      factors: ['roa', 'roe', 'debt_to_equity', 'fcf_yield'],
      tickers: ['SPY'],
    },
  },
  {
    id: 'exp_3',
    name: 'Short-term Mean Reversion',
    description: 'Testing mean reversion signals on 5-day horizons',
    status: 'draft',
    created: '2024-11-21',
    config: {
      modelType: 'RandomForest',
      factors: ['rsi', 'bollinger_bands', 'volatility'],
      tickers: ['SPY', 'QQQ'],
    },
  },
];

export function ExperimentManager() {
  const [experiments, setExperiments] = useState<Experiment[]>(mockExperiments);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedExperiments, setSelectedExperiments] = useState<string[]>([]);

  const handleCreateExperiment = () => {
    // In production, this would call the API
    setIsCreateDialogOpen(false);
  };

  const handleRunExperiment = (id: string) => {
    // In production, this would call the API to run the experiment
    console.log('Running experiment:', id);
  };

  const handleDeleteExperiment = (id: string) => {
    setExperiments(experiments.filter(exp => exp.id !== id));
  };

  const handleCompareExperiments = () => {
    // Navigate to comparison view or open comparison modal
    console.log('Comparing experiments:', selectedExperiments);
  };

  const getStatusBadge = (status: Experiment['status']) => {
    const variants = {
      draft: 'bg-muted text-muted-foreground',
      running: 'bg-chart-1/10 text-chart-1',
      completed: 'bg-chart-4/10 text-chart-4',
      failed: 'bg-destructive/10 text-destructive',
    };

    return (
      <Badge className={variants[status]}>
        {status}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Experiment Manager</h1>
          <p className="text-muted-foreground">
            Track and compare model experiments with walk-forward validation
          </p>
        </div>
        <div className="flex items-center gap-3">
          {selectedExperiments.length > 1 && (
            <Button onClick={handleCompareExperiments} variant="outline">
              <GitBranch className="w-4 h-4 mr-2" />
              Compare ({selectedExperiments.length})
            </Button>
          )}
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                New Experiment
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Create New Experiment</DialogTitle>
                <DialogDescription>
                  Configure a new model training experiment with walk-forward validation
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Experiment Name</Label>
                  <Input id="name" placeholder="e.g., Momentum + Value Strategy" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea 
                    id="description" 
                    placeholder="Describe the experiment goals and hypothesis"
                    rows={3}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="model">Model Type</Label>
                    <Select defaultValue="xgboost">
                      <SelectTrigger id="model">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="xgboost">XGBoost</SelectItem>
                        <SelectItem value="random-forest">Random Forest</SelectItem>
                        <SelectItem value="linear">Linear Regression</SelectItem>
                        <SelectItem value="ridge">Ridge Regression</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="target">Target Variable</Label>
                    <Select defaultValue="returns_1d">
                      <SelectTrigger id="target">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="returns_1d">1-Day Returns</SelectItem>
                        <SelectItem value="returns_5d">5-Day Returns</SelectItem>
                        <SelectItem value="returns_21d">21-Day Returns</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreateExperiment}>Create Experiment</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Experiments</p>
              <p className="text-2xl font-bold text-foreground mt-1">{experiments.length}</p>
            </div>
            <GitBranch className="w-8 h-8 text-muted-foreground" />
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Running</p>
              <p className="text-2xl font-bold text-foreground mt-1">
                {experiments.filter(e => e.status === 'running').length}
              </p>
            </div>
            <Play className="w-8 h-8 text-chart-1" />
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Completed</p>
              <p className="text-2xl font-bold text-foreground mt-1">
                {experiments.filter(e => e.status === 'completed').length}
              </p>
            </div>
            <TrendingUp className="w-8 h-8 text-chart-4" />
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Avg Sharpe</p>
              <p className="text-2xl font-bold text-foreground mt-1">
                {(experiments
                  .filter(e => e.performance)
                  .reduce((acc, e) => acc + (e.performance?.sharpe || 0), 0) / 
                  experiments.filter(e => e.performance).length || 0
                ).toFixed(2)}
              </p>
            </div>
            <Calendar className="w-8 h-8 text-gray-400" />
          </div>
        </Card>
      </div>

      {/* Experiments Table */}
      <Card>
        <div className="p-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <input
                    type="checkbox"
                    className="rounded border-gray-300 dark:border-gray-700"
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedExperiments(experiments.map(exp => exp.id));
                      } else {
                        setSelectedExperiments([]);
                      }
                    }}
                  />
                </TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Model</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Sharpe</TableHead>
                <TableHead>Returns</TableHead>
                <TableHead>Drawdown</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {experiments.map((experiment) => (
                <TableRow key={experiment.id}>
                  <TableCell>
                    <input
                      type="checkbox"
                      className="rounded border-gray-300 dark:border-gray-700"
                      checked={selectedExperiments.includes(experiment.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedExperiments([...selectedExperiments, experiment.id]);
                        } else {
                          setSelectedExperiments(selectedExperiments.filter(id => id !== experiment.id));
                        }
                      }}
                    />
                  </TableCell>
                  <TableCell>
                    <div>
                      <div className="text-gray-900 dark:text-white">{experiment.name}</div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">{experiment.description}</div>
                    </div>
                  </TableCell>
                  <TableCell>{getStatusBadge(experiment.status)}</TableCell>
                  <TableCell>
                    <div className="text-sm">
                      <div className="text-gray-900 dark:text-white">{experiment.config.modelType}</div>
                      <div className="text-gray-600 dark:text-gray-400">
                        {experiment.config.factors.length} factors
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-gray-600 dark:text-gray-400">
                    {new Date(experiment.created).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    {experiment.performance ? (
                      <span className="text-gray-900 dark:text-white">
                        {experiment.performance.sharpe.toFixed(2)}
                      </span>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {experiment.performance ? (
                      <span className={experiment.performance.returns >= 0 ? 'text-teal-600' : 'text-red-600'}>
                        {experiment.performance.returns >= 0 ? '+' : ''}
                        {experiment.performance.returns.toFixed(1)}%
                      </span>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {experiment.performance ? (
                      <span className="text-red-600">
                        {experiment.performance.drawdown.toFixed(1)}%
                      </span>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRunExperiment(experiment.id)}
                        disabled={experiment.status === 'running'}
                      >
                        <Play className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="sm">
                        <Copy className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="sm">
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteExperiment(experiment.id)}
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
