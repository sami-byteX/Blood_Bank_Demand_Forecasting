from rest_framework import serializers

from .models import BloodUnit, Donation


class DonationSerializer(serializers.ModelSerializer):
    donor_name = serializers.CharField(source='donor.user.full_name', read_only=True)
    donor_blood_group = serializers.CharField(source='donor.blood_group', read_only=True)
    recorded_by_name = serializers.CharField(source='recorded_by.full_name', read_only=True)

    class Meta:
        model = Donation
        fields = [
            'id',
            'donor',
            'donor_name',
            'donor_blood_group',
            'recorded_by',
            'recorded_by_name',
            'donation_date',
            'blood_group',
            'notes',
        ]
        read_only_fields = ['id', 'recorded_by', 'recorded_by_name']


class DonationCreateSerializer(serializers.ModelSerializer):
    """Used only for creating a donation. Accepts donor id, blood_group, and optional notes."""

    class Meta:
        model = Donation
        fields = ['donor', 'donation_date', 'notes']


class BloodUnitSerializer(serializers.ModelSerializer):
    donation_date = serializers.DateTimeField(source='donation.donation_date', read_only=True)
    donor_name = serializers.CharField(source='donation.donor.user.full_name', read_only=True)

    class Meta:
        model = BloodUnit
        fields = [
            'id',
            'donation',
            'donor_name',
            'donation_date',
            'blood_group',
            'collection_date',
            'expiry_date',
            'status',
        ]
        read_only_fields = ['id', 'collection_date', 'expiry_date', 'donation']
