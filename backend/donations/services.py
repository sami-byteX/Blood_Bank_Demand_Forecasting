from django.utils import timezone
from rest_framework.exceptions import ValidationError

from .models import BloodUnit, Donation


def record_donation(donor_profile, recorded_by, donation_date=None, notes=''):
    """
    Business logic for recording a donation:
    1. Check donor eligibility — raise ValidationError if ineligible.
    2. Create the Donation record using the donor's own blood group.
    3. Auto-create a BloodUnit record.
    4. Update donor's last_donation_date.
    Returns the saved Donation instance.
    """
    if not donor_profile.is_eligible:
        raise ValidationError(
            'Donor is not eligible to donate at this time. '
            'Check age, medical conditions, and donation interval.'
        )

    donation = Donation.objects.create(
        donor=donor_profile,
        recorded_by=recorded_by,
        donation_date=donation_date or timezone.now(),
        blood_group=donor_profile.blood_group,
        notes=notes,
    )

    BloodUnit.create_from_donation(donation)

    # Update last_donation_date on the donor profile
    donor_profile.last_donation_date = donation.donation_date.date()
    donor_profile.save(update_fields=['last_donation_date'])

    return donation
