from rest_framework.response import Response
from rest_framework.views import APIView

from core.constants import BLOOD_GROUP_CHOICES
from core.permissions import IsStaffOrAdmin

from .services import forecast_for_blood_group, monthly_demand_trend


class ForecastView(APIView):
    """
    GET /api/forecasting/forecast/

    For every blood group, returns:
      - 8-week rolling average demand
      - simple linear regression coefficients (slope, intercept)
      - 4 projected future weeks (per-week demand estimates)
      - projected_4wk_demand  — total units expected in the next 4 weeks
      - current_stock         — available BloodUnit count right now
      - risk_level            — HIGH if projected_4wk_demand > current_stock

    Optional filter: ?blood_group=O%2B  (URL-encode the + sign)
    """
    permission_classes = [IsStaffOrAdmin]

    def get(self, request):
        blood_group_filter = request.query_params.get('blood_group')
        blood_groups = [bg for bg, _ in BLOOD_GROUP_CHOICES]

        if blood_group_filter:
            if blood_group_filter not in blood_groups:
                return Response(
                    {'detail': f'Invalid blood group. Choices: {", ".join(blood_groups)}'},
                    status=400,
                )
            blood_groups = [blood_group_filter]

        results = [forecast_for_blood_group(bg) for bg in blood_groups]
        return Response(results)


class ShortageAlertView(APIView):
    """
    GET /api/forecasting/shortage-alerts/

    Returns only the blood groups where risk_level == HIGH.
    Useful for dashboard widgets — front-end does not need to filter the full
    forecast list itself.
    """
    permission_classes = [IsStaffOrAdmin]

    def get(self, request):
        blood_groups = [bg for bg, _ in BLOOD_GROUP_CHOICES]
        alerts = []

        for bg in blood_groups:
            result = forecast_for_blood_group(bg)
            if result['risk_level'] == 'HIGH':
                alerts.append({
                    'blood_group':          result['blood_group'],
                    'projected_4wk_demand': result['projected_4wk_demand'],
                    'current_stock':        result['current_stock'],
                    'shortfall':            result['projected_4wk_demand'] - result['current_stock'],
                    'avg_weekly_demand':    result['avg_weekly_demand'],
                })

        return Response({
            'total_high_risk_groups': len(alerts),
            'alerts': alerts,
        })


class DemandTrendView(APIView):
    """
    GET /api/forecasting/demand-trend/

    Monthly breakdown for the past 6 months: request count, units requested,
    and issuance count.  Useful for bar/line charts on the frontend.

    Required query param: ?blood_group=O%2B
    To get all groups: ?blood_group=all  (returns a dict keyed by blood group)
    """
    permission_classes = [IsStaffOrAdmin]

    def get(self, request):
        blood_groups = [bg for bg, _ in BLOOD_GROUP_CHOICES]
        bg_param = request.query_params.get('blood_group', '')

        if bg_param == 'all':
            data = {bg: monthly_demand_trend(bg) for bg in blood_groups}
            return Response(data)

        if not bg_param or bg_param not in blood_groups:
            return Response(
                {'detail': f'Provide ?blood_group=<group> or ?blood_group=all. Choices: {", ".join(blood_groups)}'},
                status=400,
            )

        return Response({
            'blood_group': bg_param,
            'trend':       monthly_demand_trend(bg_param),
        })
