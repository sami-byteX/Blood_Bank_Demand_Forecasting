from django.contrib import admin

from .models import BloodUnit, Donation


@admin.register(Donation)
class DonationAdmin(admin.ModelAdmin):
    list_display = ['id', 'donor', 'blood_group', 'donation_date', 'recorded_by']
    list_filter = ['blood_group']
    search_fields = ['donor__user__email', 'donor__user__full_name']
    readonly_fields = ['donation_date']


@admin.register(BloodUnit)
class BloodUnitAdmin(admin.ModelAdmin):
    list_display = ['id', 'blood_group', 'status', 'collection_date', 'expiry_date', 'donation']
    list_filter = ['blood_group', 'status']
    search_fields = ['donation__donor__user__full_name']
    readonly_fields = ['collection_date', 'expiry_date']
