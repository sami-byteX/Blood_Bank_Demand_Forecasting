from django.contrib import admin
from django.urls import include, path

from donations.urls import blood_unit_urlpatterns, donation_urlpatterns

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/auth/', include('core.urls')),
    path('api/donors/', include('donors.urls')),
    path('api/departments/', include('departments.urls')),
    path('api/requests/', include('requests_app.urls')),
    path('api/donations/', include(donation_urlpatterns)),
    path('api/blood-units/', include(blood_unit_urlpatterns)),
    path('api/inventory/', include('inventory.urls')),
    path('api/issuance/', include('issuance.urls')),
    path('api/reports/', include('reports.urls')),
    path('api/forecasting/', include('forecasting.urls')),
]
