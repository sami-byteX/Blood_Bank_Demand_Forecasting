from django.urls import path

from .views import (
    DonorDetailView,
    DonorListView,
    DonorProfileMeView,
    MyProfileView,
    StaffCreateDonorView,
)

urlpatterns = [
    path('me/',         DonorProfileMeView.as_view(),   name='donor_profile_me'),
    path('my-profile/', MyProfileView.as_view(),         name='donor_my_profile'),
    path('create/',     StaffCreateDonorView.as_view(),  name='donor_create_by_staff'),
    path('',            DonorListView.as_view(),          name='donor_list'),
    path('<int:pk>/',   DonorDetailView.as_view(),        name='donor_detail'),
]
