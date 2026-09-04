from django.urls import path

from .views import (
    BloodUnitDetailView, BloodUnitListView,
    DonationDetailView, DonationListCreateView, MyDonationsView,
)

donation_urlpatterns = [
    path('', DonationListCreateView.as_view(), name='donation_list_create'),
    path('my-donations/', MyDonationsView.as_view(), name='my_donations'),
    path('<int:pk>/', DonationDetailView.as_view(), name='donation_detail'),
]

blood_unit_urlpatterns = [
    path('', BloodUnitListView.as_view(), name='blood_unit_list'),
    path('<int:pk>/', BloodUnitDetailView.as_view(), name='blood_unit_detail'),
]
