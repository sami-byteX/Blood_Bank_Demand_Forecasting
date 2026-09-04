from datetime import timedelta

from django.conf import settings
from django.db import models
from django.utils import timezone

from core.constants import BLOOD_GROUP_CHOICES, BLOOD_UNIT_EXPIRY_DAYS


class Donation(models.Model):
    donor = models.ForeignKey(
        'donors.DonorProfile',
        on_delete=models.PROTECT,
        related_name='donations',
    )
    recorded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='recorded_donations',
    )
    donation_date = models.DateTimeField(default=timezone.now, db_index=True)
    blood_group = models.CharField(max_length=5, choices=BLOOD_GROUP_CHOICES, db_index=True)
    notes = models.TextField(blank=True, default='')

    def __str__(self):
        return f"Donation #{self.pk} — {self.donor} on {self.donation_date.date()}"

    class Meta:
        ordering = ['-donation_date']


class BloodUnit(models.Model):
    STATUS_CHOICES = [
        ('available', 'Available'),
        ('issued', 'Issued'),
        ('expired', 'Expired'),
    ]

    donation = models.OneToOneField(
        Donation,
        on_delete=models.PROTECT,
        related_name='blood_unit',
    )
    blood_group = models.CharField(max_length=5, choices=BLOOD_GROUP_CHOICES, db_index=True)
    collection_date = models.DateField()
    expiry_date = models.DateField(db_index=True)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='available', db_index=True)

    def __str__(self):
        return f"Unit #{self.pk} — {self.blood_group} [{self.status}] expires {self.expiry_date}"

    class Meta:
        ordering = ['expiry_date']

    @classmethod
    def create_from_donation(cls, donation):
        """Auto-create a BloodUnit from a completed Donation."""
        collection_date = donation.donation_date.date()
        expiry_date = collection_date + timedelta(days=BLOOD_UNIT_EXPIRY_DAYS)
        return cls.objects.create(
            donation=donation,
            blood_group=donation.blood_group,
            collection_date=collection_date,
            expiry_date=expiry_date,
            status='available',
        )
