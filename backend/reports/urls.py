from django.urls import path

from .views import AdminDashboardView, DonorDashboardView, StaffDashboardView

urlpatterns = [
    path('admin-dashboard/', AdminDashboardView.as_view(), name='admin_dashboard'),
    path('staff-dashboard/', StaffDashboardView.as_view(), name='staff_dashboard'),
    path('donor-dashboard/', DonorDashboardView.as_view(), name='donor_dashboard'),
]
