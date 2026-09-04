"""
Forecasting service — all maths lives here, views stay thin.

Algorithms used (no external ML libraries):
  1. Rolling Average  — mean of weekly demand over the last N weeks.
  2. Simple Linear Regression — ordinary least-squares computed from scratch
     using the closed-form formulas:
       slope     = (n·Σxy  − Σx·Σy)  / (n·Σx²  − (Σx)²)
       intercept = (Σy − slope·Σx)   / n
     Each future week's projected demand = slope·week_index + intercept (≥ 0).

Data source:
  - Demand  → BloodRequest.units_requested  (what was asked for, per blood group)
  - Stock   → BloodUnit.status == 'available'  (current on-hand inventory)
"""

from datetime import timedelta

from django.db.models import Count, Sum
from django.db.models.functions import TruncMonth
from django.utils import timezone

from donations.models import BloodUnit
from issuance.models import BloodIssuance
from requests_app.models import BloodRequest

# ── constants ────────────────────────────────────────────────────────────────
LOOKBACK_WEEKS = 26       # history window for rolling average + regression
FORECAST_WEEKS = 4        # how many weeks ahead to project
LOOKBACK_MONTHS = 6       # history window for monthly trend view
HIGH_RISK_LABEL   = 'HIGH'
MEDIUM_RISK_LABEL = 'MEDIUM'
LOW_RISK_LABEL    = 'LOW'


# ── helpers ───────────────────────────────────────────────────────────────────

def _weekly_demand_series(blood_group, num_weeks=LOOKBACK_WEEKS):
    """
    Return a list of `num_weeks` dicts, oldest-first, each containing:
      week_index  : 1 (oldest) … num_weeks (most recent)
      week_start  : ISO date string
      week_end    : ISO date string
      demand      : total units_requested in that week (int)

    Week boundaries are computed backwards from today so every week is a
    contiguous 7-day block, the most-recent week ends today.
    """
    today = timezone.now().date()
    series = []

    for i in range(num_weeks, 0, -1):
        # week that ended (num_weeks - i) full weeks before today
        week_end   = today - timedelta(weeks=i - 1)
        week_start = week_end - timedelta(days=6)

        demand = (
            BloodRequest.objects
            .filter(
                blood_group=blood_group,
                request_date__date__gte=week_start,
                request_date__date__lte=week_end,
            )
            .exclude(notes__startswith='SIMULATION')
            .aggregate(total=Sum('units_requested'))['total']
        ) or 0

        series.append({
            'week_index': num_weeks - i + 1,
            'week_start': str(week_start),
            'week_end':   str(week_end),
            'demand':     int(demand),
        })

    return series


def _rolling_average(series):
    """Return the mean demand across a weekly series list (float, 1 dp)."""
    if not series:
        return 0.0
    total = sum(w['demand'] for w in series)
    return round(total / len(series), 1)


def _simple_linear_regression(series):
    """
    Fit a line y = slope·x + intercept to the weekly demand series using the
    ordinary least-squares closed-form solution.  Returns (slope, intercept).
    If the denominator is zero (all x values identical or single point) the
    slope is 0 and intercept is the series mean.
    """
    n = len(series)
    if n == 0:
        return 0.0, 0.0

    xs = [w['week_index'] for w in series]
    ys = [w['demand']     for w in series]

    sum_x  = sum(xs)
    sum_y  = sum(ys)
    sum_xy = sum(x * y for x, y in zip(xs, ys))
    sum_x2 = sum(x * x for x in xs)

    denom = n * sum_x2 - sum_x ** 2
    if denom == 0:
        return 0.0, round(sum_y / n, 4)

    slope     = round((n * sum_xy - sum_x * sum_y) / denom, 4)
    intercept = round((sum_y - slope * sum_x) / n, 4)
    return slope, intercept


def _project_weeks(slope, intercept, from_week, num_weeks=FORECAST_WEEKS):
    """
    Project demand for `num_weeks` consecutive weeks starting at `from_week`.
    Each projected value is clamped to ≥ 0 (demand cannot be negative).
    Returns a list of dicts with week_index and projected_demand.
    """
    projections = []
    for i in range(num_weeks):
        week_i = from_week + i
        projected = slope * week_i + intercept
        projected = max(0, projected)
        projections.append({
            'week_index':       week_i,
            'projected_demand': round(projected, 1),
        })
    return projections


def _available_stock(blood_group):
    """Count of non-simulation BloodUnit records with status='available'."""
    return BloodUnit.objects.filter(
        blood_group=blood_group,
        status='available',
        expiry_date__gt=timezone.now().date(),
    ).exclude(donation__notes__startswith='SIMULATION').count()


# ── public API ────────────────────────────────────────────────────────────────

def forecast_for_blood_group(blood_group):
    """
    Full forecast for one blood group.  Returns a dict with:

      blood_group            – e.g. "O+"
      weekly_history         – list of 26 weekly demand dicts (oldest first)
      avg_weekly_demand      – rolling average over those 26 weeks
      slope / intercept      – OLS regression coefficients
      projected_weeks        – list of 4 regression-projected week dicts
      projected_4wk_demand   – sum of the 4 projected weeks (int, ≥ 0)
      current_stock          – available BloodUnit count right now
      risk_level             – HIGH  : projected_4wk_demand > current_stock
                               MEDIUM: projected_4wk_demand == current_stock
                               LOW   : projected_4wk_demand < current_stock
    """
    series = _weekly_demand_series(blood_group)
    avg    = _rolling_average(series)
    slope, intercept = _simple_linear_regression(series)

    # project starting from week LOOKBACK_WEEKS + 1
    next_week_index = LOOKBACK_WEEKS + 1
    projected = _project_weeks(slope, intercept, next_week_index)

    # Use sum of regression projected weeks so table and chart stay consistent.
    # Each week in projected is already clamped to >= 0 by _project_weeks.
    projected_total = max(0, round(sum(w['projected_demand'] for w in projected)))
    stock = _available_stock(blood_group)
    if projected_total > stock:
        risk = HIGH_RISK_LABEL
    elif projected_total == stock and projected_total > 0:
        # projected_total == 0 with stock == 0 means negligible demand — treat as LOW
        risk = MEDIUM_RISK_LABEL
    else:
        risk = LOW_RISK_LABEL

    return {
        'blood_group':          blood_group,
        'weekly_history':       series,
        'avg_weekly_demand':    avg,
        'slope':                slope,
        'intercept':            intercept,
        'projected_weeks':      projected,
        'projected_4wk_demand': projected_total,
        'current_stock':        stock,
        'risk_level':           risk,
    }


def monthly_demand_trend(blood_group, num_months=LOOKBACK_MONTHS):
    """
    Return per-month aggregates for the past `num_months` months.
    Each entry contains:
      month         – "YYYY-MM" string
      requests      – count of BloodRequest rows in that month
      units_requested – total units_requested
      issuances     – count of BloodIssuance rows in that month
    """
    today   = timezone.now()
    cutoff  = today - timedelta(days=30 * num_months)

    # Monthly request counts via TruncMonth + annotate
    req_qs = (
        BloodRequest.objects
        .exclude(notes__startswith='SIMULATION')
        .filter(blood_group=blood_group, request_date__gte=cutoff)
        .annotate(month=TruncMonth('request_date'))
        .values('month')
        .annotate(
            request_count=Count('id'),
            units_requested=Sum('units_requested'),
        )
        .order_by('month')
    )

    # Monthly issuance counts (join through blood_request)
    iss_qs = (
        BloodIssuance.objects
        .exclude(notes__startswith='SIMULATION')
        .filter(
            blood_request__blood_group=blood_group,
            issued_date__gte=cutoff,
        )
        .annotate(month=TruncMonth('issued_date'))
        .values('month')
        .annotate(issuance_count=Count('id'))
        .order_by('month')
    )

    # Build a unified month → dict map
    trend_map = {}

    for row in req_qs:
        key = row['month'].strftime('%Y-%m')
        trend_map[key] = {
            'month':           key,
            'request_count':   row['request_count']   or 0,
            'units_requested': row['units_requested'] or 0,
            'issuance_count':  0,
        }

    for row in iss_qs:
        key = row['month'].strftime('%Y-%m')
        if key in trend_map:
            trend_map[key]['issuance_count'] = row['issuance_count'] or 0
        else:
            trend_map[key] = {
                'month':           key,
                'request_count':   0,
                'units_requested': 0,
                'issuance_count':  row['issuance_count'] or 0,
            }

    return sorted(trend_map.values(), key=lambda r: r['month'])
