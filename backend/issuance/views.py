from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.views import APIView

from core.permissions import IsStaffOrAdmin

from .models import BloodIssuance
from .serializers import BloodIssuanceCreateSerializer, BloodIssuanceSerializer
from .services import issue_blood


class BloodIssuanceListView(generics.ListAPIView):
    """
    GET /api/issuance/  — Staff/Admin lists all issuance records.
    """
    permission_classes = [IsStaffOrAdmin]
    serializer_class = BloodIssuanceSerializer
    queryset = BloodIssuance.objects.select_related(
        'blood_request__department',
        'blood_unit',
        'issued_by',
    ).exclude(notes__startswith='SIMULATION').order_by('-issued_date')


class BloodIssuanceCreateView(APIView):
    """
    POST /api/issuance/  — Staff/Admin issues a blood unit against a request.
    Runs all three validation rules inside the service layer.
    """
    permission_classes = [IsStaffOrAdmin]

    def post(self, request):
        serializer = BloodIssuanceCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        validated = serializer.validated_data
        try:
            issuance = issue_blood(
                blood_request_id=validated['blood_request'],
                blood_unit_id=validated['blood_unit'],
                issued_by=request.user,
                notes=validated.get('notes', ''),
            )
        except Exception as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        return Response(BloodIssuanceSerializer(issuance).data, status=status.HTTP_201_CREATED)


class BloodIssuanceDetailView(generics.RetrieveAPIView):
    """
    GET /api/issuance/<id>/  — Staff/Admin views a specific issuance record.
    """
    permission_classes = [IsStaffOrAdmin]
    serializer_class = BloodIssuanceSerializer
    queryset = BloodIssuance.objects.select_related(
        'blood_request__department',
        'blood_unit',
        'issued_by',
    ).exclude(notes__startswith='SIMULATION')
