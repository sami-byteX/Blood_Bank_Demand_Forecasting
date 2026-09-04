"""
Management command: python manage.py reset_database

Deletes all operational records in the correct dependency order so that
no PROTECT constraint is violated.  Preserves:
  - Admin and staff CustomUser accounts
  - Department records

Intended to be run before seed_proper_data to start from a clean state.
"""

from django.core.management.base import BaseCommand
from django.db import transaction


class Command(BaseCommand):
    help = (
        'Delete all operational records (donations, units, issuances, requests, '
        'donor profiles, donor users). Keeps admin/staff accounts and departments.'
    )

    def handle(self, *args, **options):
        from core.models import CustomUser
        from donations.models import BloodUnit, Donation
        from donors.models import DonorProfile
        from issuance.models import BloodIssuance
        from requests_app.models import BloodRequest

        self.stdout.write('\nStarting database reset...\n')

        with transaction.atomic():

            # 1. BloodIssuance — references BloodUnit and BloodRequest (both PROTECT)
            total, _ = BloodIssuance.objects.all().delete()
            self.stdout.write(f'  1. BloodIssuance deleted      : {total}')

            # 2. BloodUnit — references Donation (PROTECT via OneToOne)
            total, _ = BloodUnit.objects.all().delete()
            self.stdout.write(f'  2. BloodUnit deleted          : {total}')

            # 3. Donation — references DonorProfile (PROTECT)
            total, _ = Donation.objects.all().delete()
            self.stdout.write(f'  3. Donation deleted           : {total}')

            # 4. BloodRequest — safe now that issuances are gone
            total, _ = BloodRequest.objects.all().delete()
            self.stdout.write(f'  4. BloodRequest deleted       : {total}')

            # 5. DonorProfile — safe now that donations are gone
            total, _ = DonorProfile.objects.all().delete()
            self.stdout.write(f'  5. DonorProfile deleted       : {total}')

            # 6. CustomUser (role=donor only) — CASCADE deletes any remaining profiles
            total, _ = CustomUser.objects.filter(role='donor').delete()
            self.stdout.write(f'  6. CustomUser (donor) deleted : {total}')

        self.stdout.write('\n' + '-' * 50)
        self.stdout.write('Reset complete.')
        self.stdout.write('Admin, staff, and Department records preserved.')
        self.stdout.write('-' * 50 + '\n')
