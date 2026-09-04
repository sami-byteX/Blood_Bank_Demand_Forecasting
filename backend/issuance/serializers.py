from rest_framework import serializers

from .models import BloodIssuance


class BloodIssuanceSerializer(serializers.ModelSerializer):
    issued_by_name = serializers.CharField(source='issued_by.full_name', read_only=True)
    blood_unit_group = serializers.CharField(source='blood_unit.blood_group', read_only=True)
    request_blood_group = serializers.CharField(source='blood_request.blood_group', read_only=True)
    department_name = serializers.CharField(source='blood_request.department.name', read_only=True)

    class Meta:
        model = BloodIssuance
        fields = [
            'id',
            'blood_request',
            'request_blood_group',
            'department_name',
            'blood_unit',
            'blood_unit_group',
            'issued_by',
            'issued_by_name',
            'issued_date',
            'notes',
        ]
        read_only_fields = ['id', 'issued_by', 'issued_date']


class BloodIssuanceCreateSerializer(serializers.Serializer):
    """Accepts blood_request and blood_unit IDs plus optional notes."""
    blood_request = serializers.IntegerField()
    blood_unit = serializers.IntegerField()
    notes = serializers.CharField(required=False, allow_blank=True, default='')
