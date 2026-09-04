"""
Management command: python manage.py seed_fresh_units

Creates 15 fresh available BloodUnit records per blood group (120 total)
by directly inserting Donation + BloodUnit rows. Safe to re-run — it only
ever ADDS records, never deletes or modifies existing ones.

Does NOT call record_donation() so eligibility / interval checks are
intentionally skipped for demo seeding purposes.
Does NOT modify any model, view, or migration.
"""
from datetime import timedelta

from django.core.management.base import BaseCommand
from django.db import transaction
from django.db.models import Count
from django.utils import timezone

from core.models import CustomUser
from donations.models import BloodUnit, Donation
from donors.models import DonorProfile

BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-']
UNITS_PER_GROUP = 15
EXPIRY_DAYS = 42


class Command(BaseCommand):
    help = (
        'Seed 15 fresh available BloodUnit records per blood group '
        'for demo purposes. Does not modify existing records.'
    )

    def handle(self, *args, **options):
        today = timezone.now().date()
        now   = timezone.now()

        self.stdout.write('\nSeeding fresh blood units...\n')

        # ── 1. Recorded-by: prefer first staff user, fall back to admin ──────
        staff_user = CustomUser.objects.filter(role='staff').first()
        if staff_user is None:
            staff_user = CustomUser.objects.filter(role='admin').first()
        if staff_user is None:
            self.stdout.write('ERROR: No staff or admin user found. Aborting.')
            return
        self.stdout.write(f'Recorded-by : {staff_user.email} (role={staff_user.role})')

        # ── 2. Load all donor profiles ────────────────────────────────────────
        all_profiles = list(DonorProfile.objects.select_related('user').all())
        if not all_profiles:
            self.stdout.write('ERROR: No donor profiles found. Aborting.')
            return
        self.stdout.write(f'Donor pool  : {len(all_profiles)} profile(s) loaded\n')

        # Group donors by blood_group
        donors_by_group = {}
        for profile in all_profiles:
            donors_by_group.setdefault(profile.blood_group, []).append(profile)

        # ── 3. Create records ─────────────────────────────────────────────────
        created_per_group = {}

        for bg in BLOOD_GROUPS:
            matching = donors_by_group.get(bg, [])
            if not matching:
                self.stdout.write(f'  WARNING: No donors found for {bg} — skipping.')
                created_per_group[bg] = 0
                continue

            count = 0
            try:
                with transaction.atomic():
                    for i in range(UNITS_PER_GROUP):
                        donor = matching[i % len(matching)]

                        donation = Donation.objects.create(
                            donor=donor,
                            recorded_by=staff_user,
                            donation_date=now,
                            blood_group=bg,
                            notes='Fresh demo stock',
                        )

                        BloodUnit.objects.create(
                            donation=donation,
                            blood_group=bg,
                            collection_date=today,
                            expiry_date=today + timedelta(days=EXPIRY_DAYS),
                            status='available',
                        )
                        count += 1

            except Exception as exc:
                self.stdout.write(f'  ERROR seeding {bg}: {exc}')
                created_per_group[bg] = 0
                continue

            created_per_group[bg] = count

        # ── 4. Current available totals per group ─────────────────────────────
        available_rows = (
            BloodUnit.objects
            .filter(status='available')
            .values('blood_group')
            .annotate(total=Count('id'))
        )
        available_map = {row['blood_group']: row['total'] for row in available_rows}

        # ── 5. Summary table ──────────────────────────────────────────────────
        self.stdout.write('\n' + '-' * 44)
        self.stdout.write(f'  {"Blood Group":<14} {"Created":>7}  {"Total Available":>15}')
        self.stdout.write('-' * 44)
        total_created = 0
        for bg in BLOOD_GROUPS:
            c = created_per_group.get(bg, 0)
            t = available_map.get(bg, 0)
            total_created += c
            self.stdout.write(f'  {bg:<14} {c:>7}  {t:>15}')
        self.stdout.write('-' * 44)
        self.stdout.write(f'  {"TOTAL":<14} {total_created:>7}\n')
