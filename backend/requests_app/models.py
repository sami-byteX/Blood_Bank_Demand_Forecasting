from django.conf import settings
from django.db import models
from django.utils import timezone

from core.constants import BLOOD_GROUP_CHOICES


class BloodRequest(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
        ('fulfilled', 'Fulfilled'),
    ]

    department = models.ForeignKey(
        'departments.Department',
        on_delete=models.PROTECT,
        related_name='blood_requests',
    )
    blood_group = models.CharField(max_length=5, choices=BLOOD_GROUP_CHOICES, db_index=True)
    units_requested = models.PositiveIntegerField()
    requested_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='blood_requests',
    )
    request_date = models.DateTimeField(default=timezone.now, db_index=True)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='pending', db_index=True)
    notes = models.TextField(blank=True, default='')

    def __str__(self):
        return f"{self.blood_group} x{self.units_requested} — {self.department} [{self.status}]"

    class Meta:
        ordering = ['-request_date']
