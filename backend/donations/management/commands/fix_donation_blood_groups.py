from django.core.management.base import BaseCommand

from donations.models import BloodUnit, Donation


class Command(BaseCommand):
    help = (
        'One-time data fix: set Donation.blood_group and BloodUnit.blood_group '
        'to match the donor\'s registered blood group on DonorProfile.'
    )

    def handle(self, *args, **options):
        donations = Donation.objects.select_related(
            'donor', 'blood_unit'
        ).all()

        donations_to_update = []
        units_to_update = []

        total = 0

        for donation in donations:
            total += 1
            correct_bg = donation.donor.blood_group

            if donation.blood_group != correct_bg:
                donation.blood_group = correct_bg
                donations_to_update.append(donation)

                # Update the linked BloodUnit if it exists
                try:
                    unit = donation.blood_unit
                    unit.blood_group = correct_bg
                    units_to_update.append(unit)
                except BloodUnit.DoesNotExist:
                    pass

        if donations_to_update:
            Donation.objects.bulk_update(donations_to_update, ['blood_group'])

        if units_to_update:
            BloodUnit.objects.bulk_update(units_to_update, ['blood_group'])

        self.stdout.write(f'Total donations checked: {total}')
        self.stdout.write(f'Mismatches fixed:        {len(donations_to_update)}')
        self.stdout.write(f'Blood units updated:     {len(units_to_update)}')
