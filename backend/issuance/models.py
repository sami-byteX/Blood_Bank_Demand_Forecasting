from django.conf import settings
from django.db import models
from django.utils import timezone


class BloodIssuance(models.Model):
    blood_request = models.ForeignKey(
        'requests_app.BloodRequest',
        on_delete=models.PROTECT,
        related_name='issuances',
    )
    blood_unit = models.OneToOneField(
        'donations.BloodUnit',
        on_delete=models.PROTECT,
        related_name='issuance',
    )
    issued_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='issued_blood',
    )
    issued_date = models.DateTimeField(default=timezone.now)
    notes = models.TextField(blank=True, default='')

    def __str__(self):
        return (
            f"Issuance #{self.pk} — Unit {self.blood_unit_id} "
            f"→ Request {self.blood_request_id} on {self.issued_date.date()}"
        )

    class Meta:
        ordering = ['-issued_date']
