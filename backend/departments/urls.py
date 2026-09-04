from django.urls import path

from .views import DepartmentDetailView, DepartmentListCreateView

urlpatterns = [
    path('', DepartmentListCreateView.as_view(), name='department_list_create'),
    path('<int:pk>/', DepartmentDetailView.as_view(), name='department_detail'),
]
