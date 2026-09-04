"""
Management command: python manage.py seed_proper_data

Creates clean, defensible demo data for the Blood Bank FYP viva:

  Part A : 50 donor profiles with realistic demographics
  Part B : 23-month simulation history (July 2024 - May 2026)
            - Donations respecting a 60-day interval per donor
            - Blood requests spread across departments
            - Issuances matched by COMPATIBLE_DONORS compatibility rules
  Part C : Mark expired units (never issued, past expiry_date)
  Part D : 120 fresh blood units (15 per group, expiry +42 days from today)
  Part E : 10 demo pending requests for live viva demo

Designed to run AFTER reset_database.
Part A is idempotent (get_or_create on email).
Does NOT modify any model, view, migration, or existing file.
"""

import random
from datetime import date, datetime, timedelta

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from core.constants import COMPATIBLE_DONORS
from core.models import CustomUser
from departments.models import Department
from donations.models import BloodUnit, Donation
from donors.models import DonorProfile
from issuance.models import BloodIssuance
from requests_app.models import BloodRequest

# ── Donor roster ─────────────────────────────────────────────────────────────

DONOR_NAMES = [
    'Ahmed Khan',     'Sara Malik',      'Hassan Ali',      'Fatima Noor',
    'Usman Tariq',    'Ayesha Siddiqui', 'Bilal Chaudhry',  'Maryam Raza',
    'Kamran Sheikh',  'Sana Javed',      'Zain Qureshi',    'Hina Baig',
    'Tariq Mahmood',  'Nadia Hussain',   'Faisal Mirza',    'Rabia Iqbal',
    'Imran Butt',     'Amna Farooq',     'Shahid Nawaz',    'Sadia Aziz',
    'Waheed Anwar',   'Samia Rehman',    'Nasir Gillani',   'Tahira Pasha',
    'Junaid Akram',   'Uzma Saleem',     'Arif Khawaja',    'Mehreen Zafar',
    'Khalid Lodhi',   'Nosheen Hamid',   'Asad Virk',       'Shazia Noon',
    'Omer Hayat',     'Lubna Saeed',     'Hamid Cheema',    'Bushra Waqar',
    'Nadeem Gul',     'Sumbul Riaz',     'Tauseef Rana',    'Mariam Bashir',
    'Shoaib Dar',     'Nargis Khattak',  'Mudassar Shah',   'Zara Yousuf',
    'Pervez Gondal',  'Humaira Malik',   'Sajid Mehmood',   'Faiza Durrani',
    'Irfan Bhatti',   'Amira Syed',
]  # 50 names

# Blood group assignment: 15 B+, 12 O+, 10 A+, 5 AB+, 3 B-, 2 O-, 2 A-, 1 AB-
BG_ASSIGNMENT = (
    ['B+']  * 15 +
    ['O+']  * 12 +
    ['A+']  * 10 +
    ['AB+'] * 5  +
    ['B-']  * 3  +
    ['O-']  * 2  +
    ['A-']  * 2  +
    ['AB-'] * 1
)  # 50 entries

AGES = [
    22, 25, 28, 31, 34, 37, 40, 43, 46, 35,
    24, 27, 30, 33, 36, 39, 42, 45, 32, 29,
    23, 26, 29, 32, 35, 38, 41, 44, 31, 28,
    25, 28, 31, 34, 37, 40, 43, 46, 33, 30,
    24, 27, 30, 33, 36, 39, 42, 45, 32, 29,
]  # 50 values

WEIGHTS = [
    60, 65, 70, 75, 80, 85, 68, 72, 78, 63,
    61, 66, 71, 76, 81, 86, 69, 73, 79, 64,
    62, 67, 72, 77, 82, 87, 70, 74, 80, 65,
    63, 68, 73, 78, 83, 88, 71, 75, 81, 66,
    64, 69, 74, 79, 84, 89, 72, 76, 82, 67,
]  # 50 values

# ── Simulation parameters ─────────────────────────────────────────────────────

# Target donations per blood group per month
DONATION_TARGETS = {
    'B+': 10, 'O+': 8, 'A+': 6, 'AB+': 3,
    'B-': 2,  'O-': 2, 'A-': 2, 'AB-': 1,
}

# Target requests per department per month
DEPT_TARGETS = {
    'Emergency':    8,
    'ICU':          6,
    'Surgery':      5,
    'Cardiology':   4,
    'Maternity':    3,
    'General Ward': 3,
    'Pediatrics':   2,
    'Outpatient':   2,
}

# Weighted blood group population for requests (sums to 100)
BG_REQUEST_POPULATION = (
    ['B+']  * 30 + ['O+']  * 25 + ['A+']  * 20 + ['AB+'] * 8 +
    ['B-']  * 6  + ['O-']  * 5  + ['A-']  * 4  + ['AB-'] * 2
)

ELIGIBILITY_INTERVAL_DAYS = 60   # minimum days between donations (simulation)
FRESH_GROUPS = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-']
FRESH_PER_GROUP = 15

# Demo requests for viva: (department name, blood group, units)
DEMO_REQUESTS = [
    ('Emergency',    'A+',  2),
    ('ICU',          'B+',  1),
    ('Surgery',      'O+',  3),
    ('Cardiology',   'AB+', 1),
    ('Maternity',    'B-',  2),
    ('Emergency',    'O-',  1),
    ('ICU',          'A-',  2),
    ('Surgery',      'AB-', 1),
    ('General Ward', 'B+',  2),
    ('Pediatrics',   'O+',  1),
]


class Command(BaseCommand):
    help = (
        'Seed proper demo data: 50 donors, 23-month simulation history, '
        'fresh available stock, and 10 demo pending requests.'
    )

    def _make_aware(self, year, month, day, hour=9, minute=0):
        """Return a timezone-aware datetime for the given date and time."""
        return timezone.make_aware(datetime(year, month, day, hour, minute))

    def handle(self, *args, **options):
        rng   = random.Random(42)
        today = timezone.now().date()
        now   = timezone.now()

        with transaction.atomic():

            # ── Load staff user ────────────────────────────────────────────────
            staff_user = (
                CustomUser.objects.filter(role='staff').first()
                or CustomUser.objects.filter(role='admin').first()
            )
            if staff_user is None:
                self.stdout.write('ERROR: No staff or admin user found. Aborting.')
                return

            # ── Load departments ───────────────────────────────────────────────
            dept_map = {d.name: d for d in Department.objects.all()}

            # ═══════════════════════════════════════════════════════════════════
            # PART A: Create 50 donor profiles
            # ═══════════════════════════════════════════════════════════════════
            self.stdout.write('\nPart A: Creating 50 donor profiles...')

            donor_pool = {bg: [] for bg in DONATION_TARGETS}
            users_created = 0

            for idx, name in enumerate(DONOR_NAMES):
                blood_group = BG_ASSIGNMENT[idx]
                parts  = name.lower().split()
                email  = f'{parts[0]}.{parts[-1]}@donor.bloodbank.com'
                gender = 'male' if idx < 30 else 'female'
                cnic   = f'35201-{(idx + 1):07d}-0'
                contact = f'0300-{(idx + 1):07d}'

                user, created = CustomUser.objects.get_or_create(
                    email=email,
                    defaults={
                        'full_name': name,
                        'role':      'donor',
                        'is_active': True,
                    },
                )
                if created:
                    user.set_password('Donor@1234')
                    user.save(update_fields=['password'])
                    users_created += 1

                profile, _ = DonorProfile.objects.get_or_create(
                    user=user,
                    defaults={
                        'blood_group':    blood_group,
                        'age':            AGES[idx],
                        'weight_kg':      WEIGHTS[idx],
                        'gender':         gender,
                        'cnic':           cnic,
                        'contact_number': contact,
                        'last_donation_date': None,
                    },
                )
                donor_pool[blood_group].append(profile)

            self.stdout.write(
                f'  Done. {users_created} new users created '
                f'({len(DONOR_NAMES) - users_created} already existed).'
            )

            # ═══════════════════════════════════════════════════════════════════
            # PART B: 23-month simulation (July 2024 – May 2026)
            # ═══════════════════════════════════════════════════════════════════
            self.stdout.write('\nPart B: Running 23-month simulation...')

            # Build month list
            months = []
            cur = date(2024, 7, 1)
            end = date(2026, 5, 1)
            while cur <= end:
                months.append(cur)
                cur = (
                    date(cur.year + 1, 1, 1)
                    if cur.month == 12
                    else date(cur.year, cur.month + 1, 1)
                )
            self.stdout.write(f'  Months to simulate: {len(months)}')

            # In-memory tracking (avoid repeated DB reads during inner loops)
            last_donation_dates = {}   # donor profile id  -> date
            donor_cycle         = {bg: 0 for bg in donor_pool}
            unit_records        = []   # list of dicts: id, blood_group, collection_date, expiry_date
            unit_status_map     = {}   # unit id -> 'available' | 'issued'
            fulfilled_req_ids   = []
            approved_req_ids    = []

            sim_donations  = 0
            sim_requests   = 0
            sim_issuances  = 0

            for month_start in months:
                y, m = month_start.year, month_start.month

                # ── Donations ─────────────────────────────────────────────────
                for bg, target in DONATION_TARGETS.items():
                    pool = donor_pool[bg]
                    if not pool:
                        continue

                    pool_size       = len(pool)
                    created_this_bg = 0

                    for _ in range(pool_size):
                        if created_this_bg >= target:
                            break

                        donor  = pool[donor_cycle[bg]]
                        donor_cycle[bg] = (donor_cycle[bg] + 1) % pool_size

                        don_day  = rng.randint(1, 25)
                        don_date = date(y, m, don_day)

                        last_d = last_donation_dates.get(donor.id)
                        if last_d is not None and (don_date - last_d).days < ELIGIBILITY_INTERVAL_DAYS:
                            continue  # not eligible yet this month

                        don_dt  = self._make_aware(y, m, don_day, rng.randint(8, 16), 0)
                        expiry  = don_date + timedelta(days=35)

                        donation = Donation.objects.create(
                            donor         = donor,
                            recorded_by   = staff_user,
                            donation_date = don_dt,
                            blood_group   = bg,
                            notes         = 'SIMULATION: historical forecasting data',
                        )
                        unit = BloodUnit.objects.create(
                            donation        = donation,
                            blood_group     = bg,
                            collection_date = don_date,
                            expiry_date     = expiry,
                            status          = 'available',
                        )

                        last_donation_dates[donor.id] = don_date
                        unit_status_map[unit.id]      = 'available'
                        unit_records.append({
                            'id':              unit.id,
                            'blood_group':     bg,
                            'collection_date': don_date,
                            'expiry_date':     expiry,
                        })
                        created_this_bg += 1
                        sim_donations   += 1

                # ── Blood Requests ────────────────────────────────────────────
                month_requests = []

                for dept_name, req_count in DEPT_TARGETS.items():
                    dept = dept_map.get(dept_name)
                    if dept is None:
                        continue
                    for _ in range(req_count):
                        req_day  = rng.randint(1, 25)
                        req_date = date(y, m, req_day)
                        req_dt   = self._make_aware(y, m, req_day, rng.randint(8, 17), 0)
                        bg       = rng.choice(BG_REQUEST_POPULATION)
                        units_r  = rng.randint(1, 3)

                        req = BloodRequest.objects.create(
                            department      = dept,
                            blood_group     = bg,
                            units_requested = units_r,
                            requested_by    = staff_user,
                            request_date    = req_dt,
                            status          = 'pending',
                            notes           = 'SIMULATION: historical forecasting data',
                        )
                        month_requests.append((req, req_date, bg))
                        sim_requests += 1

                # ── Issuances ─────────────────────────────────────────────────
                for req, req_date, req_bg in month_requests:
                    compatible = COMPATIBLE_DONORS.get(req_bg, [])
                    matched    = None

                    for unit_rec in unit_records:
                        if unit_status_map.get(unit_rec['id']) != 'available':
                            continue
                        if unit_rec['blood_group'] not in compatible:
                            continue
                        if unit_rec['collection_date'] > req_date:
                            continue
                        if unit_rec['expiry_date'] <= req_date:
                            continue
                        matched = unit_rec
                        break

                    if matched:
                        issue_date = req_date + timedelta(days=1)
                        issue_dt   = self._make_aware(
                            issue_date.year, issue_date.month, issue_date.day, 10, 0
                        )
                        BloodIssuance.objects.create(
                            blood_request = req,
                            blood_unit_id = matched['id'],
                            issued_by     = staff_user,
                            issued_date   = issue_dt,
                            notes         = 'SIMULATION: historical issuance',
                        )
                        unit_status_map[matched['id']] = 'issued'
                        fulfilled_req_ids.append(req.id)
                        sim_issuances += 1
                    else:
                        approved_req_ids.append(req.id)

            # ── Bulk update statuses ───────────────────────────────────────────
            self.stdout.write('  Bulk-updating unit and request statuses...')

            issued_unit_ids = [uid for uid, s in unit_status_map.items() if s == 'issued']
            BloodUnit.objects.filter(id__in=issued_unit_ids).update(status='issued')
            BloodRequest.objects.filter(id__in=fulfilled_req_ids).update(status='fulfilled')
            BloodRequest.objects.filter(id__in=approved_req_ids).update(status='approved')

            # ── Update last_donation_date on all donor profiles ─────────────────
            self.stdout.write('  Updating donor last_donation_dates...')
            profiles_to_update = []
            for donor_id, last_d in last_donation_dates.items():
                try:
                    profile = DonorProfile.objects.get(id=donor_id)
                    profile.last_donation_date = last_d
                    profiles_to_update.append(profile)
                except DonorProfile.DoesNotExist:
                    pass
            if profiles_to_update:
                DonorProfile.objects.bulk_update(profiles_to_update, ['last_donation_date'])

            self.stdout.write(
                f'  Simulation complete: {sim_donations} donations, '
                f'{sim_requests} requests, {sim_issuances} issuances.'
            )

            # ═══════════════════════════════════════════════════════════════════
            # PART C: Mark expired units
            # ═══════════════════════════════════════════════════════════════════
            self.stdout.write('\nPart C: Marking expired units...')
            expired_count = BloodUnit.objects.filter(
                status='available',
                expiry_date__lt=today,
            ).update(status='expired')
            self.stdout.write(f'  {expired_count} units marked expired.')

            # ═══════════════════════════════════════════════════════════════════
            # PART D: Fresh stock (15 units per blood group, expiry +42 days)
            # ═══════════════════════════════════════════════════════════════════
            self.stdout.write('\nPart D: Creating fresh stock (15 per group)...')
            fresh_count = 0

            FRESH_DAYS_AGO = {
                'A+': 7, 'A-': 6, 'B+': 5, 'B-': 4,
                'O+': 3, 'O-': 2, 'AB+': 1, 'AB-': 0,
            }

            for bg in FRESH_GROUPS:
                pool = donor_pool.get(bg, [])
                if not pool:
                    self.stdout.write(f'  WARNING: No donors for {bg} - skipping.')
                    continue
                days_ago = FRESH_DAYS_AGO[bg]
                don_dt   = timezone.now() - timedelta(days=days_ago)
                coll_d   = don_dt.date()
                exp_d    = coll_d + timedelta(days=42)
                for i in range(min(FRESH_PER_GROUP, len(pool))):
                    donor    = pool[i % len(pool)]
                    donation = Donation.objects.create(
                        donor         = donor,
                        recorded_by   = staff_user,
                        donation_date = don_dt,
                        blood_group   = bg,
                        notes         = 'Fresh stock for demo',
                    )
                    BloodUnit.objects.create(
                        donation        = donation,
                        blood_group     = bg,
                        collection_date = coll_d,
                        expiry_date     = exp_d,
                        status          = 'available',
                    )
                    fresh_count += 1

            self.stdout.write(f'  {fresh_count} fresh units created.')

            # Update last_donation_date for fresh stock donors if their fresh
            # donation date is more recent than what Part B recorded.
            self.stdout.write('  Updating last_donation_date for fresh stock donors...')
            fresh_profile_updates = []
            for bg in FRESH_GROUPS:
                pool = donor_pool.get(bg, [])
                if not pool:
                    continue
                days_ago = FRESH_DAYS_AGO[bg]
                fresh_coll_d = (timezone.now() - timedelta(days=days_ago)).date()
                for i in range(min(FRESH_PER_GROUP, len(pool))):
                    donor = pool[i % len(pool)]
                    if donor.last_donation_date is None or fresh_coll_d > donor.last_donation_date:
                        donor.last_donation_date = fresh_coll_d
                        fresh_profile_updates.append(donor)
            if fresh_profile_updates:
                DonorProfile.objects.bulk_update(fresh_profile_updates, ['last_donation_date'])
            self.stdout.write(f'  Updated {len(fresh_profile_updates)} donor profiles.')

            # ═══════════════════════════════════════════════════════════════════
            # PART E: Demo pending requests for viva
            # ═══════════════════════════════════════════════════════════════════
            self.stdout.write('\nPart E: Creating 10 demo pending requests...')
            demo_count = 0

            for dept_name, bg, units in DEMO_REQUESTS:
                dept = dept_map.get(dept_name)
                if dept is None:
                    self.stdout.write(f'  WARNING: Department "{dept_name}" not found - skipping.')
                    continue
                BloodRequest.objects.create(
                    department      = dept,
                    blood_group     = bg,
                    units_requested = units,
                    requested_by    = staff_user,
                    request_date    = now,
                    status          = 'pending',
                    notes           = 'Demo request for viva',
                )
                demo_count += 1

            self.stdout.write(f'  {demo_count} demo requests created.')

        # ── Summary box (ASCII-safe for Windows cp1252 terminal) ─────────────
        INNER = 42

        def border(corner, fill):
            return corner + fill * INNER + corner

        def row(text):
            content = text[:INNER - 2]
            return '| ' + content + ' ' * (INNER - 2 - len(content)) + ' |'

        self.stdout.write('')
        self.stdout.write(border('+', '='))
        self.stdout.write(row('    SEED COMPLETE -- Blood Bank FYP   '))
        self.stdout.write(border('+', '='))
        self.stdout.write(row(f'Donors created          : 50'))
        self.stdout.write(row(f'Simulation donations    : {sim_donations}'))
        self.stdout.write(row(f'Simulation requests     : {sim_requests}'))
        self.stdout.write(row(f'Simulation issuances    : {sim_issuances}'))
        self.stdout.write(row(f'Units marked expired    : {expired_count}'))
        self.stdout.write(row(f'Fresh units (available) : {fresh_count}'))
        self.stdout.write(row(f'Demo pending requests   : {demo_count}'))
        self.stdout.write(border('+', '='))
        self.stdout.write(row('FRESH STOCK BY BLOOD GROUP'))
        self.stdout.write(row('A+  : 15    A-  : 15'))
        self.stdout.write(row('B+  : 15    B-  : 15'))
        self.stdout.write(row('O+  : 15    O-  : 15'))
        self.stdout.write(row('AB+ : 15    AB- : 15'))
        self.stdout.write(border('+', '='))
        self.stdout.write('')
