from rest_framework import generics, status
from rest_framework.response import Response

from core.permissions import IsDonor, IsStaffOrAdmin
from donors.models import DonorProfile

from .models import BloodUnit, Donation
from .serializers import BloodUnitSerializer, DonationCreateSerializer, DonationSerializer
from .services import record_donation


class DonationListCreateView(generics.ListCreateAPIView):
    """
    GET  /api/donations/  — Staff/Admin lists all donations (paginated).
    POST /api/donations/  — Staff/Admin records a new donation.
                            Eligibility is enforced inside the service layer.
    """
    permission_classes = [IsStaffOrAdmin]
    serializer_class = DonationSerializer

    def get_queryset(self):
        qs = Donation.objects.select_related(
            'donor__user', 'recorded_by'
        ).exclude(
            notes__startswith='SIMULATION'
        ).order_by('-donation_date', '-id')
        blood_group = self.request.query_params.get('blood_group')
        if blood_group:
            qs = qs.filter(blood_group=blood_group)
        return qs

    def create(self, request, *args, **kwargs):
        """Custom create: validate with DonationCreateSerializer, then call service."""
        serializer = DonationCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        validated = serializer.validated_data
        try:
            donor_profile = DonorProfile.objects.get(pk=validated['donor'].pk)
        except DonorProfile.DoesNotExist:
            return Response({'detail': 'Donor profile not found.'}, status=status.HTTP_404_NOT_FOUND)

        try:
            donation = record_donation(
                donor_profile=donor_profile,
                recorded_by=request.user,
                donation_date=validated.get('donation_date'),
                notes=validated.get('notes', ''),
            )
        except Exception as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        return Response(DonationSerializer(donation).data, status=status.HTTP_201_CREATED)


class DonationDetailView(generics.RetrieveAPIView):
    """
    GET /api/donations/<id>/  — Staff/Admin views a specific donation.
    """
    permission_classes = [IsStaffOrAdmin]
    serializer_class = DonationSerializer
    queryset = Donation.objects.select_related('donor__user', 'recorded_by')


class MyDonationsView(generics.ListAPIView):
    """
    GET /api/donations/my-donations/
    Returns only the donations belonging to the authenticated donor.
    Donor role only — never exposes other donors' records.
    """
    permission_classes = [IsDonor]
    serializer_class = DonationSerializer

    def get_queryset(self):
        return Donation.objects.filter(
            donor__user=self.request.user
        ).exclude(
            notes__startswith='SIMULATION'
        ).select_related('donor__user', 'recorded_by').order_by('-donation_date')


class BloodUnitListView(generics.ListAPIView):
    """
    GET /api/blood-units/  — Staff/Admin lists all blood units.
    Supports ?status= and ?blood_group= query filters.
    """
    permission_classes = [IsStaffOrAdmin]
    serializer_class = BloodUnitSerializer

    def get_queryset(self):
        qs = BloodUnit.objects.select_related('donation__donor__user').exclude(
            donation__notes__startswith='SIMULATION'
        )
        blood_group = self.request.query_params.get('blood_group')
        unit_status = self.request.query_params.get('status')
        if blood_group:
            qs = qs.filter(blood_group=blood_group)
        if unit_status:
            qs = qs.filter(status=unit_status)
        return qs.order_by('expiry_date')


class BloodUnitDetailView(generics.RetrieveAPIView):
    """
    GET /api/blood-units/<id>/  — Staff/Admin views a specific blood unit.
    """
    permission_classes = [IsStaffOrAdmin]
    serializer_class = BloodUnitSerializer
    queryset = BloodUnit.objects.select_related('donation__donor__user').exclude(
        donation__notes__startswith='SIMULATION'
    )
