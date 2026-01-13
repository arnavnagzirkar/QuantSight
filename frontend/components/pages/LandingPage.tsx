import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { 
  TrendingUp, 
  BarChart3, 
  Brain, 
  Newspaper, 
  GitBranch, 
  Zap,
  Shield,
  Users,
  ArrowRight
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'

export default function LandingPage() {
  const navigate = useNavigate()

  const features = [
    {
      icon: Brain,
      title: 'Machine Learning Models',
      description: 'XGBoost predictions with walk-forward validation and proper out-of-sample testing'
    },
    {
      icon: BarChart3,
      title: 'Strategy Backtesting',
      description: 'Multi-asset portfolio strategies with various allocation methods and performance metrics'
    },
    {
      icon: TrendingUp,
      title: 'Factor Analysis',
      description: '60+ alpha factors with PCA diagnostics, IC analysis, and quantile return analysis'
    },
    {
      icon: Newspaper,
      title: 'Sentiment Analysis',
      description: 'NLP-powered news sentiment extraction with real-time market sentiment tracking'
    },
    {
      icon: GitBranch,
      title: 'Signal Diagnostics',
      description: 'Validate signal quality with decay analysis and correlation studies'
    },
    {
      icon: Zap,
      title: 'Real-Time Analytics',
      description: 'Live market data integration with powerful visualization and insights'
    }
  ]

  const useCases = [
    {
      icon: Users,
      title: 'Individual Traders',
      description: 'Perfect for personal trading strategies and portfolio management'
    },
    {
      icon: Shield,
      title: 'Institutions',
      description: 'Enterprise-grade tools for hedge funds and trading desks'
    },
    {
      icon: Brain,
      title: 'Students & Researchers',
      description: 'Learn quantitative finance with hands-on experimentation'
    }
  ]

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/20">
      {/* Navigation */}
      <nav className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <TrendingUp className="h-6 w-6 text-primary" />
            <span className="text-xl font-bold">QuantSight</span>
          </div>
          <div className="flex items-center space-x-4">
            <Button variant="ghost" onClick={() => navigate('/login')}>
              Sign In
            </Button>
            <Button onClick={() => navigate('/register')}>
              Get Started <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-20 text-center">
        <div className="max-w-4xl mx-auto space-y-6">
          <h1 className="text-5xl md:text-6xl font-bold tracking-tight">
            Intelligent Quantitative
            <span className="text-primary block mt-2">Research Platform</span>
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Transform market data into actionable insights with machine learning-powered 
            analysis. Backtest strategies, explore factors, and make data-driven investment decisions.
          </p>
          <div className="flex items-center justify-center gap-4 pt-4">
            <Button size="lg" onClick={() => navigate('/register')}>
              Start Free Trial <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <Button size="lg" variant="outline" onClick={() => navigate('/login')}>
              Sign In
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            No credit card required • Free forever for personal use
          </p>
        </div>
      </section>

      {/* Features Grid */}
      <section className="container mx-auto px-4 py-20">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold mb-4">Powerful Features</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Everything you need to research, test, and deploy quantitative trading strategies
          </p>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, index) => {
            const Icon = feature.icon
            return (
              <Card key={index} className="border-2 hover:border-primary/50 transition-colors">
                <CardContent className="pt-6">
                  <div className="rounded-lg bg-primary/10 w-12 h-12 flex items-center justify-center mb-4">
                    <Icon className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="font-semibold text-lg mb-2">{feature.title}</h3>
                  <p className="text-muted-foreground text-sm">{feature.description}</p>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </section>

      {/* Use Cases */}
      <section className="container mx-auto px-4 py-20 bg-secondary/30 rounded-3xl">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold mb-4">Built For Everyone</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Whether you're a solo trader, part of an institution, or learning quantitative finance
          </p>
        </div>
        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {useCases.map((useCase, index) => {
            const Icon = useCase.icon
            return (
              <div key={index} className="text-center space-y-4">
                <div className="rounded-full bg-primary/10 w-16 h-16 flex items-center justify-center mx-auto">
                  <Icon className="h-8 w-8 text-primary" />
                </div>
                <h3 className="font-semibold text-xl">{useCase.title}</h3>
                <p className="text-muted-foreground">{useCase.description}</p>
              </div>
            )
          })}
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-4 py-20 text-center">
        <div className="max-w-3xl mx-auto space-y-6">
          <h2 className="text-4xl font-bold">Ready to Get Started?</h2>
          <p className="text-xl text-muted-foreground">
            Join thousands of traders and researchers using QuantSight to make smarter decisions
          </p>
          <Button size="lg" onClick={() => navigate('/register')}>
            Create Your Free Account <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>© 2026 QuantSight. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}
