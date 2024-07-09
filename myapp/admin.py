from django.contrib import admin
from .models import *

class ItemAdmin(admin.ModelAdmin):
    # Specify the fields to display in the list view
    list_display = ('name', 'type', 'issuer', 'issue_date', 'expiry_date', 'value', 'is_used', 'user')
    
    # Specify the fields to search by
    search_fields = ('name', 'type', 'issuer', 'user__username')
    
    # Specify the filters to use in the list view
    list_filter = ('type', 'is_used', 'issue_date', 'expiry_date', 'user')

# Register the Item model with the customized ItemAdmin
admin.site.register(Item, ItemAdmin)
