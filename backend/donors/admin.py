from django.contrib import admin

from .models import DonorProfile


@admin.register(DonorProfile)
class DonorProfileAdmin(admin.ModelAdmin):
    list_display = ['user', 'blood_group', 'age', 'gender', 'cnic', 'registration_date', 'is_eligible']
    list_filter = ['blood_group', 'gender', 'has_hepatitis', 'has_hiv', 'has_heart_disease', 'recent_surgery']
    search_fields = ['user__email', 'user__full_name', 'cnic']
    readonly_fields = ['registration_date', 'is_eligible']

    fieldsets = (
        ('User', {'fields': ('user',)}),
        ('Personal Info', {'fields': ('cnic', 'contact_number', 'address', 'age', 'gender', 'blood_group')}),
        ('Donation History', {'fields': ('registration_date', 'last_donation_date')}),
        ('Medical Flags', {'fields': ('has_hepatitis', 'has_hiv', 'has_heart_disease', 'recent_surgery', 'surgery_date', 'medical_notes')}),
        ('Eligibility', {'fields': ('is_eligible',)}),
    )
