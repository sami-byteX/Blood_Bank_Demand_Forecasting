"""
Management command: python manage.py seed_missing_donors

Creates exactly 3 donor users and profiles for blood groups that have
no registered donors: AB-, B-, O-.

Safe to re-run: uses get_or_create for both User and DonorProfile.
Does NOT modify any model, view, or migration.
"""

from django.core.management.base import BaseCommand

from core.models import CustomUser
from donors.models import DonorProfile

# The three blood groups to seed and their corresponding account details.
SEED_DONORS = [
    {
        'blood_group':   'AB-',
        'email':         'donor.abminus@bloodbank.com',
        'full_name':     'Demo Donor AB-',
        'cnic':          '35200-1234567-1',
        'contact_number': '03001000001',
    },
    {
        'blood_group':   'B-',
        'email':         'donor.bminus@bloodbank.com',
        'full_name':     'Demo Donor B-',
        'cnic':          '35200-1234567-2',
        'contact_number': '03001000002',
    },
    {
        'blood_group':   'O-',
        'email':         'donor.ominus@bloodbank.com',
        'full_name':     'Demo Donor O-',
        'cnic':          '35200-1234567-3',
        'contact_number': '03001000003',
    },
]

PASSWORD = 'Demo@1234'


class Command(BaseCommand):
    help = (
        'Seed donor accounts for AB-, B-, and O- blood groups. '
        'Safe to re-run — uses get_or_create.'
    )

    def handle(self, *args, **options):
        self.stdout.write('\nSeeding missing donor profiles...\n')

        users_created    = 0
        profiles_created = 0

        for spec in SEED_DONORS:
            blood_group    = spec['blood_group']
            email          = spec['email']
            full_name      = spec['full_name']
            cnic           = spec['cnic']
            contact_number = spec['contact_number']

            # ── Step 1: CustomUser ────────────────────────────────────────
            user, user_created = CustomUser.objects.get_or_create(
                email=email,
                defaults={
                    'full_name': full_name,
                    'role':      'donor',
                    'is_active': True,
                },
            )

            if user_created:
                user.set_password(PASSWORD)
                user.save(update_fields=['password'])
                users_created += 1
                self.stdout.write(f'  [CREATED] User: {email}')
            else:
                self.stdout.write(f'  [EXISTS]  User: {email}')

            # ── Step 2: DonorProfile ──────────────────────────────────────
            profile, profile_created = DonorProfile.objects.get_or_create(
                user=user,
                defaults={
                    'blood_group':    blood_group,
                    'cnic':           cnic,
                    'contact_number': contact_number,
                    'age':            25,
                    'weight_kg':      70,
                    'gender':         'male',
                },
            )

            if profile_created:
                profiles_created += 1
                self.stdout.write(f'  [CREATED] Profile: {full_name} ({blood_group})\n')
            else:
                self.stdout.write(f'  [EXISTS]  Profile: {full_name} ({blood_group})\n')

        # ── Summary ───────────────────────────────────────────────────────
        self.stdout.write('-' * 44)
        self.stdout.write(f'Users created    : {users_created}')
        self.stdout.write(f'Profiles created : {profiles_created}')
        self.stdout.write('-' * 44 + '\n')
