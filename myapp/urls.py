from django.urls import path, include
from . import views
import uuid
from django.utils import timezone
from django.contrib.auth.models import User
from django.contrib.auth import views as auth_views
from django.contrib import admin

urlpatterns = [
    #path(r'session_security/', include('session_security.urls')),
    path("dashboard", views.dashboard, name="dashboard"),
    path('', views.show_items, name='show_items'),
    path('items/create/', views.create_item, name='create_item'),
    path('items/view/<uuid:item_uuid>', views.view_item, name='view_item'),
    path('items/edit/<uuid:item_uuid>', views.edit_item, name='edit_item'),
    path('items/delete/<uuid:item_uuid>', views.delete_item, name='delete_item'),
    #path('items/mark_as_used/<uuid:item_uuid>', views.mark_as_used, name='mark_as_used'),
    path('items/toggle_status/<uuid:item_id>', views.toggle_item_status, name='toggle_item_status'),
    path('logout/', auth_views.LogoutView.as_view(), name='logout'),
    path('user/edit/notifications', views.update_apprise_urls, name='update_apprise_urls'),
    path('transactions/delete/<uuid:transaction_id>', views.delete_transaction, name='delete_transaction'),
    path('verify-apprise-urls/', views.verify_apprise_urls, name='verify_apprise_urls'),
    path('download/<uuid:item_id>/', views.download_file, name='download_file'),
]

admin.site.site_header = "VoucherVault"
admin.site.site_title = "VoucherVault"
admin.site.index_title = "Welcome to VoucherVault"
