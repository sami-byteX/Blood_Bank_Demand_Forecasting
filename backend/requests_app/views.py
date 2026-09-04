from django.utils import timezone
from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.views import APIView

from core.permissions import IsStaffOrAdmin
from donations.models import BloodUnit

from .models import BloodRequest
from .serializers import BloodRequestSerializer, BloodRequestStatusUpdateSerializer


class BloodRequestListCreateView(generics.ListCreateAPIView):
    """
    GET  /api/requests/  — Staff/Admin lists all blood requests.
    POST /api/requests/  — Staff/Admin creates a new blood request.
    Supports ?status=pending|approved|rejected|fulfilled filter.
    """
    serializer_class = BloodRequestSerializer
    permission_classes = [IsStaffOrAdmin]

    def get_queryset(self):
        qs = (BloodRequest.objects
              .select_related('department', 'requested_by')
              .exclude(notes__startswith='SIMULATION')
              .order_by('-request_date'))
        status_filter = self.request.query_params.get('status')
        if status_filter:
            qs = qs.filter(status=status_filter)
        return qs

    def perform_create(self, serializer):
        serializer.save(requested_by=self.request.user)


class BloodRequestDetailView(generics.RetrieveAPIView):
    """
    GET /api/requests/<id>/  — Staff/Admin views a specific blood request.
    """
    serializer_class = BloodRequestSerializer
    permission_classes = [IsStaffOrAdmin]
    queryset = BloodRequest.objects.select_related('department', 'requested_by').exclude(notes__startswith='SIMULATION')


class BloodRequestStatusUpdateView(APIView):
    """
    PATCH /api/requests/<id>/status/  — Staff/Admin updates request status.
    """
    permission_classes = [IsStaffOrAdmin]

    def patch(self, request, pk):
        try:
            blood_request = BloodRequest.objects.get(pk=pk)
        except BloodRequest.DoesNotExist:
            return Response({'detail': 'Blood request not found.'}, status=status.HTTP_404_NOT_FOUND)

        # Stock availability check — only enforced when approving a request.
        new_status = request.data.get('status')
        if new_status == 'approved':
            available = BloodUnit.objects.filter(
                blood_group=blood_request.blood_group,
                status='available',
                expiry_date__gt=timezone.now().date(),
            ).exclude(donation__notes__startswith='SIMULATION').count()
            if available < blood_request.units_requested:
                return Response(
                    {
                        'error': (
                            f'Insufficient stock. Only {available} unit(s) available '
                            f'for blood group {blood_request.blood_group}.'
                        )
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

        serializer = BloodRequestStatusUpdateSerializer(blood_request, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(BloodRequestSerializer(blood_request).data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
