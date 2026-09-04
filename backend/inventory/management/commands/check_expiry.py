from django.core.management.base import BaseCommand
from django.utils import timezone

from donations.models import BloodUnit


class Command(BaseCommand):
    help = 'Mark BloodUnits as expired if their expiry_date is before today.'

    def handle(self, *args, **options):
        today = timezone.now().date()

        expired_qs = BloodUnit.objects.filter(
            status='available',
            expiry_date__lt=today,
        )
        count = expired_qs.count()

        if count == 0:
            self.stdout.write(self.style.SUCCESS('No units to expire today.'))
            return

        expired_qs.update(status='expired')
        self.stdout.write(
            self.style.SUCCESS(f'Marked {count} blood unit(s) as expired.')
        )
