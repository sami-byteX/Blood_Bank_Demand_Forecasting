from django.conf import settings
from django.db import models
from django.utils import timezone

from core.constants import MAX_DONOR_AGE, MIN_DONATION_INTERVAL_DAYS, MIN_DONOR_AGE
from core.constants import BLOOD_GROUP_CHOICES


class DonorProfile(models.Model):
    GENDER_CHOICES = [
        ('male', 'Male'),
        ('female', 'Female'),
        ('other', 'Other'),
    ]

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='donor_profile',
        limit_choices_to={'role': 'donor'},
    )
    cnic = models.CharField(max_length=15, unique=True)
    contact_number = models.CharField(max_length=15)
    address = models.TextField(blank=True, default='')
    age = models.PositiveIntegerField()
    weight_kg = models.DecimalField(max_digits=5, decimal_places=1, null=True, blank=True)
    gender = models.CharField(max_length=10, choices=GENDER_CHOICES)
    blood_group = models.CharField(max_length=5, choices=BLOOD_GROUP_CHOICES)
    registration_date = models.DateField(auto_now_add=True)
    last_donation_date = models.DateField(null=True, blank=True)

    # Medical flags — staff-only visibility
    has_hepatitis = models.BooleanField(default=False)
    has_hiv = models.BooleanField(default=False)
    has_heart_disease = models.BooleanField(default=False)
    recent_surgery = models.BooleanField(default=False)
    surgery_date = models.DateField(null=True, blank=True)
    medical_notes = models.TextField(blank=True, default='')

    def __str__(self):
        return f"{self.user.full_name} ({self.blood_group})"

    @property
    def is_eligible(self):
        """
        Returns True if the donor passes all eligibility checks:
        - Age within allowed range
        - No disqualifying medical conditions
        - Sufficient interval since last donation
        """
        if not (MIN_DONOR_AGE <= self.age <= MAX_DONOR_AGE):
            return False
        if self.has_hepatitis or self.has_hiv or self.has_heart_disease:
            return False
        if self.recent_surgery:
            return False
        if self.last_donation_date:
            days_since = (timezone.now().date() - self.last_donation_date).days
            if days_since < MIN_DONATION_INTERVAL_DAYS:
                return False
        return True
