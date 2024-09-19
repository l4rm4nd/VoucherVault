from django import template
import os
from django.conf import settings

register = template.Library()

@register.filter
def env(key):
    if key == "OIDC_ENABLED":
        return settings.OIDC_ENABLED
    if key == "VERSION":
        return settings.VERSION
    if key == "EXPIRY_THRESHOLD":
        threshold_days = os.getenv('EXPIRY_THRESHOLD_DAYS', 30)
        return threshold_days

@register.filter()
def comma_to_dot(value):
    return str(value).replace(',', '.')    