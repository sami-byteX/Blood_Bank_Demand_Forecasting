"""
Management command: python manage.py generate_forecast_data

Generates 24 months of realistic synthetic blood-bank data for forecasting
training.

SAFETY CONTRACT
- Never deletes or modifies existing records.
- Only appends new Donation, BloodUnit, BloodRequest, and BloodIssuance rows.
- Uses existing DonorProfile, CustomUser, and Department records.
- All writes go through Django ORM; no raw SQL.
"""

import random
from datetime import date, timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone

from core.constants import BLOOD_UNIT_EXPIRY_DAYS, COMPATIBLE_DONORS
from core.models import CustomUser
from departments.models import Department
from donations.models import BloodUnit, Donation
from donors.models import DonorProfile
from issuance.models import BloodIssuance
from requests_app.models import BloodRequest

# ── Reproducible seed ────────────────────────────────────────────────────────
SEED = 42

# ── Blood group distribution (realistic Pakistani population) ────────────────
BG_WEIGHTS = {
    'B+':  35, 'O+': 30, 'A+': 20, 'AB+': 7,
    'B-':  3,  'O-':  2, 'A-':  2, 'AB-': 1,
}

# ── Department distribution for requests ────────────────────────────────────
# Name → weight.  Only 5 departments are used for the synthetic requests.
DEPT_WEIGHTS = {
    'Emergency':    30,
    'ICU':          25,
    'Surgery':      20,
    'Maternity':    15,
    'General Ward': 10,
}

# ── Request status distribution ──────────────────────────────────────────────
STATUS_WEIGHTS = {
    'fulfilled': 60,
    'approved':  20,
    'rejected':  10,
    'pending':   10,
}

# ── Target volumes ────────────────────────────────────────────────────────────
TARGET_DONATIONS_MIN = 400
TARGET_DONATIONS_MAX = 500
TARGET_REQUESTS_MIN  = 600
TARGET_REQUESTS_MAX  = 700
MONTHS               = 24


def weighted_choice(rng, weight_dict):
    """Pick one key from a dict of {item: weight} using the given RNG."""
    population = list(weight_dict.keys())
    weights    = list(weight_dict.values())
    return rng.choices(population, weights=weights, k=1)[0]


def seasonal_factor(month: int, base: int, kind: str) -> int:
    """
    Apply a seasonal multiplier to a base monthly count.
    kind='donation' : +10% winter (Nov-Feb), -10% summer (Jun-Aug)
    kind='request'  : +15% summer (Jun-Aug)
    Returns an integer count.
    """
    if kind == 'donation':
        if month in (11, 12, 1, 2):   # winter boost
            return round(base * 1.10)
        if month in (6, 7, 8):        # summer dip
            return round(base * 0.90)
    elif kind == 'request':
        if month in (6, 7, 8):        # summer heat-emergency spike
            return round(base * 1.15)
    return base


class Command(BaseCommand):
    help = 'Generate 24 months of synthetic blood-bank data for forecasting training.'

    # ── helpers ───────────────────────────────────────────────────────────────

    def _load_existing(self):
        """Load existing DB objects that synthetic records will reference."""
        donor_profiles = list(DonorProfile.objects.select_related('user').all())
        if not donor_profiles:
            self.stdout.write(self.style.ERROR(
                'No DonorProfile records found. '
                'Please create at least one donor profile before running this command.'
            ))
            raise SystemExit(1)

        staff_users = list(
            CustomUser.objects.filter(role__in=['admin', 'staff'], is_active=True)
        )
        if not staff_users:
            staff_users = list(CustomUser.objects.filter(role='admin', is_active=True))

        dept_map = {d.name: d for d in Department.objects.filter(is_active=True)}
        available_depts = [dept_map[name] for name in DEPT_WEIGHTS if name in dept_map]
        if not available_depts:
            available_depts = list(Department.objects.filter(is_active=True))

        return donor_profiles, staff_users, available_depts, dept_map

    def _make_datetime(self, rng, target_date: date):
        """Return a timezone-aware datetime on target_date at a random hour."""
        hour   = rng.randint(7, 21)
        minute = rng.randint(0, 59)
        naive  = timezone.datetime(
            target_date.year, target_date.month, target_date.day, hour, minute
        )
        return timezone.make_aware(naive)

    # ── main ──────────────────────────────────────────────────────────────────

    def handle(self, *args, **options):
        rng   = random.Random(SEED)
        today = timezone.now().date()

        # ── Load existing objects ──────────────────────────────────────────────
        self.stdout.write('Loading existing database objects…')
        donor_profiles, staff_users, available_depts, dept_map = self._load_existing()

        self.stdout.write(
            f'  Donor profiles: {len(donor_profiles)} | '
            f'Staff users: {len(staff_users)} | '
            f'Departments: {len(available_depts)}'
        )

        # ── Decide total volumes ───────────────────────────────────────────────
        total_donations_target = rng.randint(TARGET_DONATIONS_MIN, TARGET_DONATIONS_MAX)
        total_requests_target  = rng.randint(TARGET_REQUESTS_MIN,  TARGET_REQUESTS_MAX)

        base_donations_per_month = total_donations_target // MONTHS  # ~17-21
        base_requests_per_month  = total_requests_target  // MONTHS  # ~25-29

        # ── Build month list (24 months back, oldest first) ───────────────────
        months = []
        for offset in range(MONTHS - 1, -1, -1):
            # first day of each month, offset months back from today's month
            first = (today.replace(day=1) - timedelta(days=offset * 30)).replace(day=1)
            months.append(first)

        # ── Phase 1: Generate Donations + BloodUnits ──────────────────────────
        self.stdout.write('\nPhase 1 — Generating donations and blood units…')

        new_donations  = []
        new_blood_units = []

        # pool of blood units indexed by blood_group for later issuance matching
        unit_pool: dict[str, list] = {bg: [] for bg in BG_WEIGHTS}

        donor_cycle_idx = 0

        for month_start in months:
            month_int   = month_start.month
            days_in_m   = (
                (month_start.replace(month=month_start.month % 12 + 1, day=1)
                 if month_start.month < 12
                 else month_start.replace(year=month_start.year + 1, month=1, day=1))
                - timedelta(days=1)
            ).day

            count = seasonal_factor(month_int, base_donations_per_month, 'donation')
            count = max(15, min(25, count + rng.randint(-2, 2)))

            for _ in range(count):
                day        = rng.randint(1, days_in_m)
                don_date   = month_start.replace(day=day)
                don_dt     = self._make_datetime(rng, don_date)
                blood_group = weighted_choice(rng, BG_WEIGHTS)
                donor       = donor_profiles[donor_cycle_idx % len(donor_profiles)]
                staff       = rng.choice(staff_users)
                donor_cycle_idx += 1

                donation = Donation(
                    donor       = donor,
                    recorded_by = staff,
                    donation_date = don_dt,
                    blood_group   = blood_group,
                    notes         = 'SIMULATION: forecast training data',
                )
                new_donations.append(donation)

        # Bulk-create all donations, then build units from the saved objects
        self.stdout.write(f'  Inserting {len(new_donations)} donations…')
        created_donations = Donation.objects.bulk_create(new_donations)

        for donation in created_donations:
            col_date    = donation.donation_date.date()
            expiry_date = col_date + timedelta(days=BLOOD_UNIT_EXPIRY_DAYS)
            # Status will be patched after issuances are built; default available
            unit = BloodUnit(
                donation       = donation,
                blood_group    = donation.blood_group,
                collection_date = col_date,
                expiry_date    = expiry_date,
                status         = 'available',
            )
            new_blood_units.append(unit)
            unit_pool[donation.blood_group].append(unit)

        self.stdout.write(f'  Inserting {len(new_blood_units)} blood units…')
        BloodUnit.objects.bulk_create(new_blood_units)

        # Re-fetch units from DB so we have PKs for issuance linking
        saved_units = list(
            BloodUnit.objects
            .filter(donation__in=created_donations)
            .select_related('donation')
        )
        # Rebuild the pool with saved (PK-assigned) unit objects
        unit_pool = {bg: [] for bg in BG_WEIGHTS}
        for unit in saved_units:
            unit_pool[unit.blood_group].append(unit)

        # ── Phase 2: Generate Blood Requests ──────────────────────────────────
        self.stdout.write('\nPhase 2 — Generating blood requests…')

        new_requests = []

        # Identify which departments to use per the spec weight
        weighted_depts = {
            d: DEPT_WEIGHTS[d.name]
            for d in available_depts
            if d.name in DEPT_WEIGHTS
        }
        # Fall back to all available departments if our named ones aren't present
        if not weighted_depts:
            weighted_depts = {d: 1 for d in available_depts}

        staff_user = staff_users[0]  # default requester (admin or staff)

        for month_start in months:
            month_int = month_start.month
            days_in_m = (
                (month_start.replace(month=month_start.month % 12 + 1, day=1)
                 if month_start.month < 12
                 else month_start.replace(year=month_start.year + 1, month=1, day=1))
                - timedelta(days=1)
            ).day

            count = seasonal_factor(month_int, base_requests_per_month, 'request')
            count = max(25, min(35, count + rng.randint(-2, 2)))

            for _ in range(count):
                day      = rng.randint(1, days_in_m)
                req_date = month_start.replace(day=day)
                req_dt   = self._make_datetime(rng, req_date)
                bg       = weighted_choice(rng, BG_WEIGHTS)
                dept     = weighted_choice(rng, weighted_depts)
                status   = weighted_choice(rng, STATUS_WEIGHTS)
                units_req = rng.randint(1, 3)

                new_requests.append(BloodRequest(
                    department      = dept,
                    blood_group     = bg,
                    units_requested = units_req,
                    requested_by    = staff_user,
                    request_date    = req_dt,
                    status          = status,
                    notes           = 'SIMULATION: forecast training data',
                ))

        self.stdout.write(f'  Inserting {len(new_requests)} blood requests…')
        created_requests = BloodRequest.objects.bulk_create(new_requests)

        # ── Phase 3: Generate Issuances for fulfilled requests ────────────────
        self.stdout.write('\nPhase 3 — Generating issuances for fulfilled requests…')

        fulfilled_requests = [r for r in created_requests if r.status == 'fulfilled']
        # Sort oldest first so we consume earlier units first
        fulfilled_requests.sort(key=lambda r: r.request_date)

        issued_unit_ids  = set()
        new_issuances    = []
        skipped          = 0

        for req in fulfilled_requests:
            compatible_groups = COMPATIBLE_DONORS.get(req.blood_group, [])
            matched_unit = None

            for bg in compatible_groups:
                pool = unit_pool.get(bg, [])
                for candidate in pool:
                    if candidate.id not in issued_unit_ids:
                        # Only use units collected at or before the request date
                        if candidate.collection_date <= req.request_date.date():
                            matched_unit = candidate
                            break
                if matched_unit:
                    break

            if matched_unit is None:
                skipped += 1
                # Downgrade this request to 'approved' since no unit is available
                req.status = 'approved'
                continue

            issued_unit_ids.add(matched_unit.id)
            issue_dt = self._make_datetime(
                rng,
                req.request_date.date() + timedelta(days=rng.randint(0, 2))
            )
            new_issuances.append(BloodIssuance(
                blood_request = req,
                blood_unit    = matched_unit,
                issued_by     = rng.choice(staff_users),
                issued_date   = issue_dt,
                notes         = 'SIMULATION: forecast training issuance',
            ))

        self.stdout.write(f'  Inserting {len(new_issuances)} issuances ({skipped} fulfilled->approved: no compatible unit found)')
        BloodIssuance.objects.bulk_create(new_issuances)

        # ── Phase 4: Patch BloodUnit statuses ─────────────────────────────────
        self.stdout.write('\nPhase 4 — Patching blood unit statuses…')

        expired_ids   = []
        issued_ids    = list(issued_unit_ids)

        # Units older than BLOOD_UNIT_EXPIRY_DAYS and NOT issued → expired
        for unit in saved_units:
            if unit.id not in issued_unit_ids:
                if unit.expiry_date < today:
                    expired_ids.append(unit.id)

        BloodUnit.objects.filter(id__in=issued_ids).update(status='issued')
        BloodUnit.objects.filter(id__in=expired_ids).update(status='expired')
        # Remaining (not issued, not expired) stay as 'available'

        # Patch request statuses for any downgraded fulfilled→approved requests
        downgraded = [r for r in fulfilled_requests if r.status == 'approved']
        if downgraded:
            dg_ids = [r.id for r in downgraded]
            BloodRequest.objects.filter(id__in=dg_ids).update(status='approved')

        # ── Summary ───────────────────────────────────────────────────────────
        self.stdout.write('\n' + '─' * 55)
        self.stdout.write(self.style.SUCCESS('✓ Synthetic data generation complete.\n'))
        self.stdout.write(f'  Donations created   : {len(created_donations)}')
        self.stdout.write(f'  Blood units created : {len(saved_units)}')
        self.stdout.write(f'    → issued          : {len(issued_ids)}')
        self.stdout.write(f'    → expired         : {len(expired_ids)}')
        self.stdout.write(f'    → available       : {len(saved_units) - len(issued_ids) - len(expired_ids)}')
        self.stdout.write(f'  Requests created    : {len(created_requests)}')
        self.stdout.write(f'  Issuances created   : {len(new_issuances)}')
        self.stdout.write('─' * 55)
        self.stdout.write(
            '\nExisting records (ids 1-5 donations, 1-13 requests) were NOT modified.'
        )
