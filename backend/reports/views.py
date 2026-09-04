from datetime import timedelta

from django.db.models import Count, Q
from django.utils import timezone
from rest_framework.response import Response
from rest_framework.views import APIView

from core.constants import BLOOD_GROUP_CHOICES
from core.permissions import IsAdmin, IsDonor, IsStaffOrAdmin
from donations.models import BloodUnit, Donation
from donors.models import DonorProfile
from issuance.models import BloodIssuance
from requests_app.models import BloodRequest

LOW_STOCK_THRESHOLD = 5
EXPIRY_ALERT_DAYS = 7


class AdminDashboardView(APIView):
    """
    GET /api/reports/admin-dashboard/
    Admin-only. All figures computed via ORM aggregates — no Python iteration.
    """
    permission_classes = [IsAdmin]

    def get(self, request):
        today = timezone.now().date()
        now = timezone.now()
        month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

        # --- Donors ---
        total_donors = DonorProfile.objects.count()

        # --- Donations ---
        total_donations = Donation.objects.exclude(notes__startswith='SIMULATION').count()

        # --- Inventory: available / issued / expired per blood group — 1 query ---
        counts_qs = (
            BloodUnit.objects
            .exclude(donation__notes__startswith='SIMULATION')
            .values('blood_group')
            .annotate(
                available=Count('id', filter=Q(status='available')),
                issued=Count('id', filter=Q(status='issued')),
                expired=Count('id', filter=Q(status='expired')),
            )
        )
        counts_map = {row['blood_group']: row for row in counts_qs}
        inventory = [
            {
                'blood_group': bg,
                'available': counts_map.get(bg, {}).get('available', 0),
                'issued':    counts_map.get(bg, {}).get('issued', 0),
                'expired':   counts_map.get(bg, {}).get('expired', 0),
            }
            for bg, _ in BLOOD_GROUP_CHOICES
        ]

        # --- Requests by status ---
        requests_by_status = (
            BloodRequest.objects
            .exclude(notes__startswith='SIMULATION')
            .values('status')
            .annotate(count=Count('id'))
            .order_by('status')
        )

        # --- Issuances this month ---
        issuances_this_month = BloodIssuance.objects.filter(
            issued_date__gte=month_start
        ).exclude(notes__startswith='SIMULATION').count()

        # --- Expired units ---
        expired_units = BloodUnit.objects.filter(status='expired').exclude(
            donation__notes__startswith='SIMULATION'
        ).count()

        return Response({
            'total_donors': total_donors,
            'total_donations': total_donations,
            'inventory': inventory,
            'requests_by_status': list(requests_by_status),
            'issuances_this_month': issuances_this_month,
            'expired_units': expired_units,
        })


class StaffDashboardView(APIView):
    """
    GET /api/reports/staff-dashboard/
    Staff and Admin. All figures via ORM aggregates.
    """
    permission_classes = [IsStaffOrAdmin]

    def get(self, request):
        today = timezone.now().date()
        alert_cutoff = today + timedelta(days=EXPIRY_ALERT_DAYS)

        # --- Today's donations (exclude seeded simulation records) ---
        todays_donations = Donation.objects.filter(
            donation_date__date=today
        ).exclude(notes__startswith='SIMULATION').count()

        # --- Pending requests ---
        pending_requests = BloodRequest.objects.filter(status='pending').exclude(
            notes__startswith='SIMULATION'
        ).count()

        # --- Low stock: blood groups with available units < threshold — 1 query ---
        available_qs = (
            BloodUnit.objects
            .exclude(donation__notes__startswith='SIMULATION')
            .filter(status='available')
            .values('blood_group')
            .annotate(available=Count('id'))
        )
        available_map = {row['blood_group']: row['available'] for row in available_qs}
        low_stock = [
            {
                'blood_group': bg,
                'available': available_map.get(bg, 0),
                'threshold': LOW_STOCK_THRESHOLD,
            }
            for bg, _ in BLOOD_GROUP_CHOICES
            if available_map.get(bg, 0) < LOW_STOCK_THRESHOLD
        ]

        # --- Expiry alerts: available units expiring within 7 days ---
        expiry_alerts = BloodUnit.objects.filter(
            status='available',
            expiry_date__lte=alert_cutoff,
            expiry_date__gte=today,
        ).exclude(donation__notes__startswith='SIMULATION').count()

        return Response({
            'todays_donations': todays_donations,
            'pending_requests': pending_requests,
            'low_stock': low_stock,
            'expiry_alerts_count': expiry_alerts,
        })


class DonorDashboardView(APIView):
    """
    GET /api/reports/donor-dashboard/
    Donor-only. Returns the authenticated donor's own stats.
    """
    permission_classes = [IsDonor]

    def get(self, request):
        try:
            profile = request.user.donor_profile
        except DonorProfile.DoesNotExist:
            return Response({
                'donation_count': 0,
                'last_donation_date': None,
                'is_eligible': False,
                'detail': 'No donor profile found. Please complete your profile.',
            })

        donation_count = Donation.objects.filter(donor=profile).exclude(notes__startswith='SIMULATION').count()

        return Response({
            'donation_count': donation_count,
            'last_donation_date': profile.last_donation_date,
            'is_eligible': profile.is_eligible,
            'blood_group': profile.blood_group,
        })
