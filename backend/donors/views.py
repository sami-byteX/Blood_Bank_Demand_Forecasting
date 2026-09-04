from django.db import transaction

from rest_framework import generics, status
from rest_framework.filters import SearchFilter
from rest_framework.response import Response
from rest_framework.views import APIView

from core.models import CustomUser
from core.permissions import IsDonor, IsStaffOrAdmin

from .models import DonorProfile
from .serializers import DonorProfileSerializer, DonorPublicSerializer, StaffCreateDonorSerializer


class DonorProfileMeView(APIView):
    """
    GET  /api/donors/me/       — Donor views their own profile.
    POST /api/donors/me/       — Donor creates their profile (once only).
    PATCH /api/donors/me/      — Donor updates their own profile.
    """
    permission_classes = [IsDonor]

    def get(self, request):
        try:
            profile = request.user.donor_profile
        except DonorProfile.DoesNotExist:
            return Response({'detail': 'Profile not found. Please create your profile.'}, status=status.HTTP_404_NOT_FOUND)
        return Response(DonorPublicSerializer(profile).data)

    def post(self, request):
        if hasattr(request.user, 'donor_profile'):
            return Response({'detail': 'Profile already exists. Use PATCH to update.'}, status=status.HTTP_400_BAD_REQUEST)
        serializer = DonorPublicSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(user=request.user)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def patch(self, request):
        try:
            profile = request.user.donor_profile
        except DonorProfile.DoesNotExist:
            return Response({'detail': 'Profile not found.'}, status=status.HTTP_404_NOT_FOUND)
        serializer = DonorPublicSerializer(profile, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class MyProfileView(APIView):
    """
    GET /api/donors/my-profile/
    Returns the authenticated donor's own profile.
    Returns 404 if the donor has not created a profile yet.
    Read-only — profile creation/editing uses /api/donors/me/.
    """
    permission_classes = [IsDonor]

    def get(self, request):
        try:
            profile = request.user.donor_profile
        except DonorProfile.DoesNotExist:
            return Response(
                {'detail': 'Profile not found. Please create your profile.'},
                status=status.HTTP_404_NOT_FOUND,
            )
        return Response(DonorPublicSerializer(profile).data)


class DonorListView(generics.ListAPIView):
    """
    GET /api/donors/                  — Staff/Admin lists all donor profiles.
    GET /api/donors/?search=query     — Filter by donor name or CNIC (DB-level, not client-side).
    """
    permission_classes = [IsStaffOrAdmin]
    serializer_class   = DonorProfileSerializer
    queryset           = DonorProfile.objects.select_related('user').order_by('registration_date')
    filter_backends    = [SearchFilter]
    search_fields      = ['cnic', 'user__full_name']


class DonorDetailView(generics.RetrieveAPIView):
    """
    GET /api/donors/<id>/      — Staff/Admin views a specific donor profile.
    """
    permission_classes = [IsStaffOrAdmin]
    serializer_class = DonorProfileSerializer
    queryset = DonorProfile.objects.select_related('user')


class StaffCreateDonorView(APIView):
    """
    POST /api/donors/create/

    Staff or Admin creates a new donor user account and profile in one request.

    Accepts: full_name, email, password, cnic, contact_number, gender,
             blood_group, age, weight_kg, address (optional)

    The user account (CustomUser, role=donor) and DonorProfile are created
    inside a single atomic transaction.  If the profile creation fails after
    the user has been written, the entire transaction is rolled back — no
    orphaned user records.
    """
    permission_classes = [IsStaffOrAdmin]

    def post(self, request):
        serializer = StaffCreateDonorSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        data = serializer.validated_data

        with transaction.atomic():
            user = CustomUser.objects.create_user(
                email=data['email'],
                full_name=data['full_name'],
                password=data['password'],
                role='donor',
            )
            profile = DonorProfile.objects.create(
                user=user,
                cnic=data['cnic'],
                contact_number=data['contact_number'],
                gender=data['gender'],
                blood_group=data['blood_group'],
                age=data['age'],
                weight_kg=data['weight_kg'],
                address=data.get('address', ''),
            )

        return Response(
            DonorProfileSerializer(profile).data,
            status=status.HTTP_201_CREATED,
        )
