import { useState } from 'react';
import { Play, Save, Settings } from 'lucide-react';
import { ParamGridEditor } from '../ParamGridEditor';
import { FeatureImportanceChart } from '../charts/FeatureImportanceChart';

export function ModelLab() {
  const [trainWindow, setTrainWindow] = useState(252);
  const [testWindow, setTestWindow] = useState(21);
  const [maxFolds, setMaxFolds] = useState(10);
  const [running, setRunning] = useState(false);
  const [params, setParams] = useState({
    max_depth: 6,
    learning_rate: 0.1,
    n_estimators: 100,
    subsample: 0.8,
    colsample_bytree: 0.8,
  });

  const handleRun = () => {
    setRunning(true);
    setTimeout(() => setRunning(false), 2000);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Model Lab</h1>
          <p className="text-muted-foreground">
            Configure and train walk-forward XGBoost models with parameter sweeps
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 px-4 py-2 border border-border text-foreground rounded-lg hover:bg-accent transition-colors shadow-sm">
            <Save className="w-4 h-4" />
            <span>Save Config</span>
          </button>
          <button
            onClick={handleRun}
            disabled={running}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
          >
            {running ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Running...</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                <span>Run Model</span>
              </>
            )}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-card border border-border rounded-lg p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Settings className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">Walk-Forward Config</h2>
          </div>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-muted-foreground mb-2">
                Train Window (days)
              </label>
              <input
                type="number"
                value={trainWindow}
                onChange={(e) => setTrainWindow(parseInt(e.target.value))}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
              />
            </div>

            <div>
              <label className="block text-sm text-muted-foreground mb-2">
                Test Window (days)
              </label>
              <input
                type="number"
                value={testWindow}
                onChange={(e) => setTestWindow(parseInt(e.target.value))}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
              />
            </div>

            <div>
              <label className="block text-sm text-muted-foreground mb-2">
                Max Folds
              </label>
              <input
                type="number"
                value={maxFolds}
                onChange={(e) => setMaxFolds(parseInt(e.target.value))}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
              />
            </div>

            <div className="pt-4 border-t border-border">
              <div className="flex items-center gap-2 mb-3">
                <input type="checkbox" id="persist" className="rounded border-border" />
                <label htmlFor="persist" className="text-sm text-foreground cursor-pointer">
                  Persist final model
                </label>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="pca" className="rounded border-border" defaultChecked />
                <label htmlFor="pca" className="text-sm text-foreground cursor-pointer">
                  Include PCA diagnostics
                </label>
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-2">
          <div className="bg-card border border-border rounded-lg p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-foreground mb-4">Hyperparameter Grid</h2>
            <ParamGridEditor params={params} onChange={(p) => setParams(p as any)} />
          </div>
        </div>
      </div>

      <div className="bg-card border border-border rounded-lg p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-foreground mb-4">Feature Importance (Aggregated)</h2>
        <FeatureImportanceChart />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-card border border-border rounded-lg p-6 shadow-sm">
          <div className="text-sm text-muted-foreground mb-1">Best Sharpe Ratio</div>
          <div className="text-2xl font-bold text-foreground">1.85</div>
          <div className="text-sm text-chart-4 mt-1">Fold 7/10</div>
        </div>
        <div className="bg-card border border-border rounded-lg p-6 shadow-sm">
          <div className="text-sm text-muted-foreground mb-1">Avg Accuracy</div>
          <div className="text-2xl font-bold text-foreground">62.3%</div>
          <div className="text-sm text-muted-foreground mt-1">All folds</div>
        </div>
        <div className="bg-card border border-border rounded-lg p-6 shadow-sm">
          <div className="text-sm text-muted-foreground mb-1">Best Params</div>
          <div className="text-sm text-foreground mt-2">
            <div>max_depth: 5</div>
            <div>learning_rate: 0.05</div>
          </div>
        </div>
      </div>
    </div>
  );
}
