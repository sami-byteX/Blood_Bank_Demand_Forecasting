from rest_framework import generics
from rest_framework.permissions import IsAuthenticated

from core.permissions import IsAdmin, IsStaffOrAdmin

from .models import Department
from .serializers import DepartmentSerializer


class DepartmentListCreateView(generics.ListCreateAPIView):
    """
    GET  /api/departments/  — Any authenticated user can list departments.
    POST /api/departments/  — Staff/Admin only can create a department.
    """
    serializer_class = DepartmentSerializer

    def get_queryset(self):
        return Department.objects.all()

    def get_permissions(self):
        if self.request.method == 'GET':
            return [IsAuthenticated()]
        return [IsStaffOrAdmin()]


class DepartmentDetailView(generics.RetrieveUpdateDestroyAPIView):
    """
    GET    /api/departments/<id>/  — Any authenticated user.
    PATCH  /api/departments/<id>/  — Staff/Admin only.
    DELETE /api/departments/<id>/  — Admin only.
    """
    serializer_class = DepartmentSerializer
    queryset = Department.objects.all()

    def get_permissions(self):
        if self.request.method == 'GET':
            return [IsAuthenticated()]
        if self.request.method == 'DELETE':
            return [IsAdmin()]
        return [IsStaffOrAdmin()]
