"""
Management command: python manage.py fix_fresh_stock

Removes duplicate fresh stock donations that were created before
the seed command enforced one-per-donor.

Keeps the LATEST donation (highest id) per donor per blood group.
Deletes all earlier duplicates and their linked BloodUnit records.

Safe to run on a live DB - only touches notes='Fresh stock for demo'.
"""

from django.core.management.base import BaseCommand
from django.db import transaction

from donations.models import BloodUnit, Donation


class Command(BaseCommand):
    help = 'Remove duplicate fresh stock donations, keeping one per donor per blood group.'

    def handle(self, *args, **options):
        with transaction.atomic():
            fresh_qs = Donation.objects.filter(notes='Fresh stock for demo')
            total_before = fresh_qs.count()

            # Find the latest (highest id) donation per (donor, blood_group) pair.
            keep_ids = {}
            for d in fresh_qs.values('id', 'donor_id', 'blood_group'):
                key = (d['donor_id'], d['blood_group'])
                if key not in keep_ids or d['id'] > keep_ids[key]:
                    keep_ids[key] = d['id']

            ids_to_keep   = set(keep_ids.values())
            ids_to_delete = list(
                fresh_qs.exclude(id__in=ids_to_keep).values_list('id', flat=True)
            )

            if not ids_to_delete:
                self.stdout.write('Nothing to clean up - already one per donor.')
                return

            units_deleted, _     = BloodUnit.objects.filter(donation_id__in=ids_to_delete).delete()
            donations_deleted, _ = Donation.objects.filter(id__in=ids_to_delete).delete()

            self.stdout.write(f'Before  : {total_before} fresh stock donations')
            self.stdout.write(f'Removed : {donations_deleted} duplicate donations')
            self.stdout.write(f'Removed : {units_deleted} linked blood units')
            self.stdout.write(f'Kept    : {len(ids_to_keep)} (one per donor per blood group)')
            self.stdout.write('Done.')
