from django.urls import path

from .views import DemandTrendView, ForecastView, ShortageAlertView

urlpatterns = [
    path('forecast/',         ForecastView.as_view(),       name='forecast'),
    path('shortage-alerts/',  ShortageAlertView.as_view(),  name='shortage_alerts'),
    path('demand-trend/',     DemandTrendView.as_view(),    name='demand_trend'),
]
