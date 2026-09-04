from django.urls import path

from .views import BloodIssuanceCreateView, BloodIssuanceDetailView, BloodIssuanceListView

urlpatterns = [
    path('', BloodIssuanceListView.as_view(), name='issuance_list'),
    path('create/', BloodIssuanceCreateView.as_view(), name='issuance_create'),
    path('<int:pk>/', BloodIssuanceDetailView.as_view(), name='issuance_detail'),
]
