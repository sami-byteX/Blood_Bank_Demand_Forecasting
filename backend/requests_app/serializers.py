from rest_framework import serializers

from .models import BloodRequest


class BloodRequestSerializer(serializers.ModelSerializer):
    requested_by_name = serializers.CharField(source='requested_by.full_name', read_only=True)
    department_name = serializers.CharField(source='department.name', read_only=True)

    class Meta:
        model = BloodRequest
        fields = [
            'id',
            'department',
            'department_name',
            'blood_group',
            'units_requested',
            'requested_by',
            'requested_by_name',
            'request_date',
            'status',
            'notes',
        ]
        read_only_fields = ['id', 'requested_by', 'request_date']


class BloodRequestStatusUpdateSerializer(serializers.ModelSerializer):
    """Used by staff to update only the status of a blood request."""

    class Meta:
        model = BloodRequest
        fields = ['status']

    def validate_status(self, value):
        # 'fulfilled' is intentionally excluded — it may only be set by the
        # issuance app (issuance/services.py) when a BloodIssuance record is created.
        allowed = ['pending', 'approved', 'rejected']
        if value not in allowed:
            raise serializers.ValidationError(
                f'Status must be one of: {", ".join(allowed)}. '
                f"'fulfilled' can only be set via blood issuance."
            )
        return value
