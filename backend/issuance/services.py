from django.utils import timezone
from rest_framework.exceptions import ValidationError

from core.constants import COMPATIBLE_DONORS
from donations.models import BloodUnit
from requests_app.models import BloodRequest

from .models import BloodIssuance


def issue_blood(blood_request_id, blood_unit_id, issued_by, notes=''):
    """
    Business logic for issuing blood:
    1. Fetch and validate the BloodRequest exists.
    2. Fetch and validate the BloodUnit exists.
    3. Rule A — BloodUnit.status must be 'available'.
    4. Rule B — BloodUnit must not be expired (expiry_date >= today).
    5. Rule C — BloodUnit.blood_group must be compatible with request blood_group
                using COMPATIBLE_DONORS from core/constants.py.
    6. Create the BloodIssuance record.
    7. Mark BloodUnit.status = 'issued'.
    8. Mark BloodRequest.status = 'fulfilled'.
    Returns the created BloodIssuance instance.
    """
    try:
        blood_request = BloodRequest.objects.get(pk=blood_request_id)
    except BloodRequest.DoesNotExist:
        raise ValidationError(f'Blood request #{blood_request_id} not found.')

    try:
        blood_unit = BloodUnit.objects.get(pk=blood_unit_id)
    except BloodUnit.DoesNotExist:
        raise ValidationError(f'Blood unit #{blood_unit_id} not found.')

    # Rule A: unit must be available
    if blood_unit.status != 'available':
        raise ValidationError(
            f'Blood unit #{blood_unit_id} is not available (current status: {blood_unit.status}).'
        )

    # Rule B: unit must not be expired
    today = timezone.now().date()
    if blood_unit.expiry_date < today:
        raise ValidationError(
            f'Blood unit #{blood_unit_id} expired on {blood_unit.expiry_date}.'
        )

    # Rule C: blood group compatibility
    request_bg = blood_request.blood_group
    unit_bg = blood_unit.blood_group
    compatible = COMPATIBLE_DONORS.get(request_bg, [])
    if unit_bg not in compatible:
        raise ValidationError(
            f'Blood unit {unit_bg} is not compatible with request blood group {request_bg}. '
            f'Compatible donors for {request_bg}: {", ".join(compatible)}.'
        )

    # All checks passed — create issuance record
    issuance = BloodIssuance.objects.create(
        blood_request=blood_request,
        blood_unit=blood_unit,
        issued_by=issued_by,
        issued_date=timezone.now(),
        notes=notes,
    )

    # Side effects
    blood_unit.status = 'issued'
    blood_unit.save(update_fields=['status'])

    blood_request.status = 'fulfilled'
    blood_request.save(update_fields=['status'])

    return issuance
