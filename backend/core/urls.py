from django.urls import path
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from .views import DonorRegisterView, MeView, StaffCreateView, UserListView, UserToggleActiveView

urlpatterns = [
    path('login/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('register/', DonorRegisterView.as_view(), name='donor_register'),
    path('users/create-staff/', StaffCreateView.as_view(), name='staff_create'),
    path('users/', UserListView.as_view(), name='user_list'),
    path('users/<int:pk>/toggle-active/', UserToggleActiveView.as_view(), name='user_toggle_active'),
    path('me/', MeView.as_view(), name='me'),
]
