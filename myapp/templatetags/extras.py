from django import template
import os
from django.conf import settings

register = template.Library()

@register.filter
def env(key):
    if key == "OIDC_ENABLED":
        return settings.OIDC_ENABLED

@register.filter()
def comma_to_dot(value):
    return str(value).replace(',', '.')    