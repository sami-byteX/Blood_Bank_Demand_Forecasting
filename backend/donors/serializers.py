import re

from rest_framework import serializers

from core.constants import BLOOD_GROUP_CHOICES
from .models import DonorProfile

# ── Shared validators ────────────────────────────────────────────────────────

CNIC_RE    = re.compile(r'^\d{5}-\d{7}-\d{1}$')
CONTACT_RE = re.compile(r'^(?:\+92|0)3\d{9}$')


def validate_cnic(value):
    if not CNIC_RE.match(value):
        raise serializers.ValidationError(
            'CNIC must be in format: 36302-1234567-1'
        )
    return value


def validate_contact_number(value):
    if not CONTACT_RE.match(value):
        raise serializers.ValidationError(
            'Contact must be a valid Pakistani number: 03001234567 or +923001234567'
        )
    return value


# ── Serializers ──────────────────────────────────────────────────────────────

class DonorProfileSerializer(serializers.ModelSerializer):
    """Full serializer — for staff and admin only. Exposes all fields including medical."""
    user_email     = serializers.EmailField(source='user.email',      read_only=True)
    user_full_name = serializers.CharField(source='user.full_name',   read_only=True)
    is_eligible    = serializers.BooleanField(read_only=True)

    class Meta:
        model = DonorProfile
        fields = [
            'id',
            'user',
            'user_email',
            'user_full_name',
            'cnic',
            'contact_number',
            'address',
            'age',
            'weight_kg',
            'gender',
            'blood_group',
            'registration_date',
            'last_donation_date',
            'has_hepatitis',
            'has_hiv',
            'has_heart_disease',
            'recent_surgery',
            'surgery_date',
            'medical_notes',
            'is_eligible',
        ]
        read_only_fields = ['id', 'user', 'registration_date']

    def validate_cnic(self, value):
        return validate_cnic(value)

    def validate_contact_number(self, value):
        return validate_contact_number(value)


class DonorPublicSerializer(serializers.ModelSerializer):
    """
    Donor-facing serializer. Must NOT expose sensitive medical fields.
    Safe for the donor to read/update their own profile.
    """
    user_email     = serializers.EmailField(source='user.email',    read_only=True)
    user_full_name = serializers.CharField(source='user.full_name', read_only=True)
    is_eligible    = serializers.BooleanField(read_only=True)

    class Meta:
        model = DonorProfile
        fields = [
            'id',
            'user_email',
            'user_full_name',
            'cnic',
            'contact_number',
            'address',
            'age',
            'weight_kg',
            'gender',
            'blood_group',
            'registration_date',
            'last_donation_date',
            'is_eligible',
        ]
        read_only_fields = ['id', 'registration_date', 'last_donation_date']

    def validate_cnic(self, value):
        return validate_cnic(value)

    def validate_contact_number(self, value):
        return validate_contact_number(value)


class StaffCreateDonorSerializer(serializers.Serializer):
    """
    Used by staff to create a donor user account + profile in a single request.
    Validates all fields before any DB write occurs.
    """
    # ── User account fields ──────────────────────────────────────────────────
    full_name = serializers.CharField(max_length=150)
    email     = serializers.EmailField()
    password  = serializers.CharField(min_length=8, write_only=True)

    # ── Profile fields ───────────────────────────────────────────────────────
    cnic           = serializers.CharField(max_length=15)
    contact_number = serializers.CharField(max_length=15)
    gender         = serializers.ChoiceField(choices=['male', 'female', 'other'])
    blood_group    = serializers.ChoiceField(choices=[bg for bg, _ in BLOOD_GROUP_CHOICES])
    age            = serializers.IntegerField(min_value=17, max_value=65)
    weight_kg      = serializers.DecimalField(max_digits=5, decimal_places=1)
    address        = serializers.CharField(required=False, allow_blank=True, default='')

    def validate_email(self, value):
        from core.models import CustomUser
        if CustomUser.objects.filter(email=value).exists():
            raise serializers.ValidationError('A user with this email already exists.')
        return value

    def validate_cnic(self, value):
        validate_cnic(value)   # format check
        if DonorProfile.objects.filter(cnic=value).exists():
            raise serializers.ValidationError('A donor with this CNIC already exists.')
        return value

    def validate_contact_number(self, value):
        return validate_contact_number(value)

    def validate_weight_kg(self, value):
        if value < 50:
            raise serializers.ValidationError('Weight must be at least 50 kg.')
        return value
