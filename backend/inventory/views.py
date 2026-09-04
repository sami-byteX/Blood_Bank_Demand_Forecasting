from datetime import timedelta

from django.db.models import Count, Q
from django.utils import timezone
from rest_framework.response import Response
from rest_framework.views import APIView

from core.constants import BLOOD_GROUP_CHOICES
from core.permissions import IsStaffOrAdmin
from donations.models import BloodUnit

LOW_STOCK_THRESHOLD = 5
EXPIRY_ALERT_DAYS = 7


class InventoryView(APIView):
    """
    GET /api/inventory/
    Returns count of available, issued, and expired units per blood group.

    Single annotated queryset replaces the previous loop that fired 3 COUNT
    queries per blood group (24 queries total).  Now 1 query.
    """
    permission_classes = [IsStaffOrAdmin]

    def get(self, request):
        today = timezone.now().date()
        # One query: group by blood_group, count each status with conditional aggregation.
        # 'available' only counts non-expired units so stale units don't inflate the figure.
        rows = (
            BloodUnit.objects
            .exclude(donation__notes__startswith='SIMULATION')
            .values('blood_group')
            .annotate(
                available=Count('id', filter=Q(status='available') & Q(expiry_date__gt=today)),
                issued=Count('id', filter=Q(status='issued')),
                expired=Count('id', filter=Q(status='expired')),
                total_units=Count('id'),
            )
        )
        # Index results by blood_group for O(1) lookup below.
        counts = {r['blood_group']: r for r in rows}

        # Iterate BLOOD_GROUP_CHOICES to preserve canonical order and include
        # blood groups that have zero BloodUnit records (absent from the queryset).
        summary = []
        for bg, _ in BLOOD_GROUP_CHOICES:
            row       = counts.get(bg, {'available': 0, 'issued': 0, 'expired': 0, 'total_units': 0})
            available = row['available']
            issued    = row['issued']
            expired   = row['expired']
            summary.append({
                'blood_group': bg,
                'available':   available,
                'issued':      issued,
                'expired':     expired,
                'total':       row['total_units'],
            })

        return Response(summary)


class LowStockView(APIView):
    """
    GET /api/inventory/low-stock/
    Returns blood groups where available units are below the threshold (< 5).

    Single annotated queryset replaces the previous loop that fired 1 COUNT
    query per blood group (8 queries total).  Now 1 query.
    """
    permission_classes = [IsStaffOrAdmin]

    def get(self, request):
        # One query: count non-expired available units per blood_group.
        rows = (
            BloodUnit.objects
            .exclude(donation__notes__startswith='SIMULATION')
            .filter(status='available', expiry_date__gt=timezone.now().date())
            .values('blood_group')
            .annotate(available=Count('id'))
        )
        # Index by blood_group; groups absent from the queryset have 0 available.
        counts = {r['blood_group']: r['available'] for r in rows}

        low_stock = []
        for bg, _ in BLOOD_GROUP_CHOICES:
            available = counts.get(bg, 0)
            if available < LOW_STOCK_THRESHOLD:
                low_stock.append({
                    'blood_group': bg,
                    'available':   available,
                    'threshold':   LOW_STOCK_THRESHOLD,
                })

        return Response(low_stock)


class ExpiryAlertView(APIView):
    """
    GET /api/inventory/expiry-alerts/
    Returns available BloodUnit records expiring within the next 7 days.
    """
    permission_classes = [IsStaffOrAdmin]

    def get(self, request):
        today = timezone.now().date()
        alert_cutoff = today + timedelta(days=EXPIRY_ALERT_DAYS)

        expiring_units = BloodUnit.objects.filter(
            status='available',
            expiry_date__lte=alert_cutoff,
            expiry_date__gte=today,
        ).exclude(
            donation__notes__startswith='SIMULATION'
        ).select_related('donation__donor__user').order_by('expiry_date')

        data = [
            {
                'id': unit.id,
                'blood_group': unit.blood_group,
                'collection_date': unit.collection_date,
                'expiry_date': unit.expiry_date,
                'days_until_expiry': (unit.expiry_date - today).days,
                'status': unit.status,
                'donation_id': unit.donation_id,
            }
            for unit in expiring_units
        ]

        return Response(data)
