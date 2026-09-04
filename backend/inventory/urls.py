from django.urls import path

from .views import ExpiryAlertView, InventoryView, LowStockView

urlpatterns = [
    path('', InventoryView.as_view(), name='inventory'),
    path('low-stock/', LowStockView.as_view(), name='low_stock'),
    path('expiry-alerts/', ExpiryAlertView.as_view(), name='expiry_alerts'),
]
