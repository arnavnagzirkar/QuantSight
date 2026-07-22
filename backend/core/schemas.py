from datetime import date, timedelta
import re

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


TICKER_PATTERN = re.compile(r"^[A-Z0-9.^-]{1,15}$")


class FactorComputeRequest(BaseModel):
    ticker: str = "AAPL"
    start_date: date = date(2015, 1, 1)
    end_date: date | None = None
    rows: int = Field(default=100, ge=1, le=500)
    factors: list[str] = Field(default_factory=list, max_length=60)
    include_pca: bool = True

    @field_validator("ticker")
    @classmethod
    def normalize_ticker(cls, value: str) -> str:
        ticker = value.strip().upper()
        if not TICKER_PATTERN.fullmatch(ticker):
            raise ValueError("Ticker must contain only letters, numbers, '.', '^', or '-'")
        return ticker

    @field_validator("factors")
    @classmethod
    def normalize_factors(cls, values: list[str]) -> list[str]:
        normalized = list(dict.fromkeys(value.strip() for value in values if value.strip()))
        if any(not re.fullmatch(r"[a-zA-Z0-9_]+", value) for value in normalized):
            raise ValueError("Factor names may contain only letters, numbers, and underscores")
        return normalized

    @model_validator(mode="after")
    def validate_date_range(self):
        if self.end_date is not None and self.end_date < self.start_date:
            raise ValueError("end_date must be on or after start_date")
        return self


class TickerAnalysisQuery(BaseModel):
    ticker: str
    start_date: date = Field(default_factory=lambda: date.today() - timedelta(days=550))
    end_date: date = Field(default_factory=date.today)

    @field_validator("ticker")
    @classmethod
    def normalize_ticker(cls, value: str) -> str:
        ticker = value.strip().upper()
        if not TICKER_PATTERN.fullmatch(ticker):
            raise ValueError("Ticker must contain only letters, numbers, '.', '^', or '-'")
        return ticker

    @model_validator(mode="after")
    def validate_date_range(self):
        if self.end_date < self.start_date:
            raise ValueError("end_date must be on or after start_date")
        return self


class SentimentQuery(BaseModel):
    ticker: str
    start_date: date = Field(default_factory=lambda: date.today() - timedelta(days=7))
    end_date: date = Field(default_factory=date.today)
    limit: int = Field(default=50, ge=1, le=100)

    @field_validator("ticker")
    @classmethod
    def normalize_ticker(cls, value: str) -> str:
        ticker = value.strip().upper()
        if not TICKER_PATTERN.fullmatch(ticker):
            raise ValueError("Ticker must contain only letters, numbers, '.', '^', or '-'")
        return ticker

    @model_validator(mode="after")
    def validate_date_range(self):
        if self.end_date < self.start_date:
            raise ValueError("end_date must be on or after start_date")
        return self


class PasswordSignInRequest(BaseModel):
    identifier: str = Field(min_length=3, max_length=254)
    password: str = Field(min_length=1, max_length=256)

    @field_validator("identifier")
    @classmethod
    def normalize_identifier(cls, value: str) -> str:
        identifier = value.strip()
        if "@" in identifier:
            if not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", identifier):
                raise ValueError("Enter a valid email address or username")
            return identifier.lower()
        username = identifier.lower()
        if not re.fullmatch(r"[a-z0-9_]{3,30}", username):
            raise ValueError("Username must be 3 to 30 letters, numbers, or underscores")
        return username


class UsernameAvailabilityQuery(BaseModel):
    username: str

    @field_validator("username")
    @classmethod
    def normalize_username(cls, value: str) -> str:
        username = value.strip().lower()
        if not re.fullmatch(r"[a-z0-9_]{3,30}", username):
            raise ValueError("Username must be 3 to 30 letters, numbers, or underscores")
        return username


class UserSettingsUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    theme: Literal["light", "dark", "system"]
    timezone: str = Field(min_length=1, max_length=64)
    default_tickers: list[str] = Field(min_length=1, max_length=50)
    default_model_type: Literal["xgb", "lstm", "ensemble"]
    default_train_window: int = Field(ge=250, le=3000)
    default_test_window: int = Field(ge=5, le=252)
    default_max_folds: int = Field(ge=1, le=50)
    notify_job_complete: bool

    @field_validator("timezone")
    @classmethod
    def validate_timezone(cls, value: str) -> str:
        timezone = value.strip()
        if not re.fullmatch(r"[A-Za-z0-9_+\-/]+", timezone):
            raise ValueError("Enter a valid IANA timezone")
        return timezone

    @field_validator("default_tickers")
    @classmethod
    def normalize_tickers(cls, values: list[str]) -> list[str]:
        tickers = list(dict.fromkeys(value.strip().upper() for value in values if value.strip()))
        if not tickers or any(not TICKER_PATTERN.fullmatch(ticker) for ticker in tickers):
            raise ValueError("Enter valid ticker symbols")
        return tickers


class ModelTrainingRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=1, max_length=100)
    ticker: str
    model_type: Literal["xgb", "lstm", "ensemble"] = "xgb"
    horizon: Literal["1d", "5d", "20d"] = "1d"
    start_date: date = date(2015, 1, 1)
    end_date: date | None = None
    train_window: int = Field(default=750, ge=250, le=3000)
    test_window: int = Field(default=63, ge=5, le=252)
    max_folds: int = Field(default=10, ge=1, le=50)
    xgb_params: dict = Field(default_factory=dict)
    lstm_params: dict = Field(default_factory=dict)
    ensemble_weights: dict[str, float] = Field(
        default_factory=lambda: {"xgb": 0.5, "lstm": 0.5}
    )

    @field_validator("ticker")
    @classmethod
    def normalize_ticker(cls, value: str) -> str:
        ticker = value.strip().upper()
        if not TICKER_PATTERN.fullmatch(ticker):
            raise ValueError("Enter a valid ticker symbol")
        return ticker

    @field_validator("name")
    @classmethod
    def normalize_name(cls, value: str) -> str:
        return value.strip()

    @field_validator("ensemble_weights")
    @classmethod
    def validate_ensemble_weights(cls, values: dict[str, float]) -> dict[str, float]:
        if set(values) != {"xgb", "lstm"}:
            raise ValueError("Ensemble weights must define xgb and lstm")
        if any(value < 0 for value in values.values()) or abs(sum(values.values()) - 1.0) > 1e-9:
            raise ValueError("Ensemble weights must be nonnegative and sum to 1")
        return values

    @model_validator(mode="after")
    def validate_model_configuration(self):
        if self.end_date is not None and self.end_date < self.start_date:
            raise ValueError("end_date must be on or after start_date")
        if self.test_window >= self.train_window:
            raise ValueError("test_window must be smaller than train_window")
        return self


class StrategyBacktestRequest(ModelTrainingRequest):
    name: str = "Strategy Backtest"
    ticker: str = "AAPL"
    position_rule: Literal["long_only", "long_short"] = "long_short"
    initial_capital: float = Field(default=100000.0, gt=0, le=1000000000.0)
    cost_bps: float = Field(default=5.0, ge=0, le=1000)


class PortfolioRunRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(default="Portfolio Run", min_length=1, max_length=100)
    tickers: list[str] = Field(default_factory=lambda: ["AAPL", "MSFT"], min_length=1, max_length=100)
    start_date: date = date(2018, 1, 1)
    end_date: date | None = None
    signal: str = Field(default="mom_20", min_length=1, max_length=64)
    allocation_method: Literal[
        "equal_weight",
        "risk_parity",
        "mean_variance",
        "signal_weighted",
        "quantile",
    ] = "equal_weight"
    rebalance: Literal["daily", "weekly", "monthly"] = "weekly"
    cost_bps: float = Field(default=5.0, ge=0, le=1000)
    benchmark: str = "SPY"
    n_quantiles: int = Field(default=5, ge=2, le=20)
    long_quantile: int = Field(default=5, ge=1, le=20)
    short_quantile: int = Field(default=1, ge=1, le=20)

    @field_validator("name", "signal")
    @classmethod
    def normalize_text(cls, value: str) -> str:
        return value.strip()

    @field_validator("tickers")
    @classmethod
    def normalize_tickers(cls, values: list[str]) -> list[str]:
        tickers = list(dict.fromkeys(value.strip().upper() for value in values if value.strip()))
        if not tickers or any(not TICKER_PATTERN.fullmatch(ticker) for ticker in tickers):
            raise ValueError("Enter valid ticker symbols")
        return tickers

    @field_validator("benchmark")
    @classmethod
    def normalize_benchmark(cls, value: str) -> str:
        benchmark = value.strip().upper()
        if not TICKER_PATTERN.fullmatch(benchmark):
            raise ValueError("Enter a valid benchmark ticker")
        return benchmark

    @model_validator(mode="after")
    def validate_configuration(self):
        if self.end_date is not None and self.end_date < self.start_date:
            raise ValueError("end_date must be on or after start_date")
        if self.long_quantile > self.n_quantiles or self.short_quantile > self.n_quantiles:
            raise ValueError("Selected quantiles cannot exceed n_quantiles")
        if self.long_quantile == self.short_quantile:
            raise ValueError("Long and short quantiles must differ")
        return self


class JobListQuery(BaseModel):
    limit: int = Field(default=20, ge=1, le=100)


class SignalAnalysisRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    ticker: str = "AAPL"
    start_date: date = date(2018, 1, 1)
    end_date: date | None = None
    signal: str = "mom_20"
    horizons: list[int] = Field(default_factory=lambda: [1, 3, 5, 10, 20], min_length=1, max_length=5)
    return_horizon: Literal[1, 3, 5, 10, 20] = 5
    quantiles: int = Field(default=5, ge=2, le=10)
    rolling_window: int = Field(default=252, ge=60, le=1000)

    @field_validator("ticker")
    @classmethod
    def normalize_ticker(cls, value: str) -> str:
        ticker = value.strip().upper()
        if not TICKER_PATTERN.fullmatch(ticker):
            raise ValueError("Enter a valid ticker symbol")
        return ticker

    @field_validator("signal")
    @classmethod
    def normalize_signal(cls, value: str) -> str:
        signal = value.strip()
        if not re.fullmatch(r"[a-zA-Z0-9_]+", signal):
            raise ValueError("Enter a valid signal name")
        return signal

    @field_validator("horizons")
    @classmethod
    def validate_horizons(cls, values: list[int]) -> list[int]:
        normalized = list(dict.fromkeys(values))
        if any(value not in {1, 3, 5, 10, 20} for value in normalized):
            raise ValueError("Horizons must be selected from 1, 3, 5, 10, and 20")
        return normalized

    @model_validator(mode="after")
    def validate_dates(self):
        if self.end_date is not None and self.end_date < self.start_date:
            raise ValueError("end_date must be on or after start_date")
        return self


class ExperimentRequest(ModelTrainingRequest):
    description: str | None = Field(default=None, max_length=1000)

    @field_validator("description")
    @classmethod
    def normalize_description(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip()
        return normalized or None


class ExperimentComparisonRequest(BaseModel):
    job_ids: list[str] = Field(min_length=2, max_length=4)

    @field_validator("job_ids")
    @classmethod
    def unique_job_ids(cls, values: list[str]) -> list[str]:
        unique = list(dict.fromkeys(values))
        if len(unique) < 2:
            raise ValueError("Select at least two different runs")
        return unique