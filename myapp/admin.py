from django.contrib import admin
from .models import *
from django.urls import path
from django.urls import reverse
from django.utils.html import format_html
from django.utils.translation import gettext_lazy as _

class UserProfileAdmin(admin.ModelAdmin):
    list_display = ('user', 'apprise_urls')

class ItemAdmin(admin.ModelAdmin):
    # Specify the fields to display in the list view
    list_display = ('name', 'type', 'issuer', 'issue_date', 'expiry_date', 'value', 'is_used', 'user')
    
    # Specify the fields to search by
    search_fields = ('name', 'type', 'issuer', 'user__username')
    
    # Specify the filters to use in the list view
    list_filter = ('type', 'is_used', 'issue_date', 'expiry_date', 'user')


class AppSettingsAdmin(admin.ModelAdmin):
    list_display = ('api_token', 'updated_at', 'regenerate_token_button')
    readonly_fields = ('api_token', 'updated_at', 'regenerate_token_button')  # Include the button here

    def has_add_permission(self, request):
        # Check if there is already an existing object in the model
        if self.model.objects.count() >= 1:
            return False  # Disallow adding a new object
        else:
            return True   # Allow adding a new object    

    def regenerate_token_button(self, obj):
        """Add a button to regenerate the API token."""
        if obj.pk:  # Only display the button for existing objects
            url = reverse('admin:regenerate_api_token', args=[obj.pk])
            return format_html(
                '<a class="button" href="{}">Regenerate API Token</a>', url
            )
        return "Save this object before regenerating the token."
    regenerate_token_button.short_description = "Actions"
    regenerate_token_button.allow_tags = True

    def get_urls(self):
        """Extend the admin URL patterns to include custom actions."""
        urls = super().get_urls()
        custom_urls = [
            path('<int:pk>/regenerate-token/', self.admin_site.admin_view(self.regenerate_token), name='regenerate_api_token'),
        ]
        return custom_urls + urls

    def regenerate_token(self, request, pk):
        """Regenerate the API token for the selected AppSettings instance."""
        from django.http import HttpResponseRedirect
        from django.contrib import messages
        try:
            app_settings = AppSettings.objects.get(pk=pk)
            app_settings.regenerate_api_token()
            messages.success(request, "API token regenerated successfully!")
        except AppSettings.DoesNotExist:
            messages.error(request, "AppSettings instance not found.")
        return HttpResponseRedirect(reverse('admin:myapp_appsettings_changelist'))

admin.site.register(Item, ItemAdmin)
admin.site.register(Transaction)
admin.site.register(AppSettings, AppSettingsAdmin)