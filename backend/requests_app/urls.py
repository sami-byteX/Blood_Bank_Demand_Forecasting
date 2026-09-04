from django.urls import path

from .views import BloodRequestDetailView, BloodRequestListCreateView, BloodRequestStatusUpdateView

urlpatterns = [
    path('', BloodRequestListCreateView.as_view(), name='blood_request_list_create'),
    path('<int:pk>/', BloodRequestDetailView.as_view(), name='blood_request_detail'),
    path('<int:pk>/status/', BloodRequestStatusUpdateView.as_view(), name='blood_request_status_update'),
]
