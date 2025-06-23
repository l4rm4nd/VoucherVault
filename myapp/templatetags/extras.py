from django import template
import os
import re
from django.conf import settings

register = template.Library()

@register.filter
def env(key):
    if key == "OIDC_ENABLED":
        return settings.OIDC_ENABLED
    if key == "OIDC_AUTOLOGIN":
        return settings.OIDC_AUTOLOGIN        
    if key == "VERSION":
        return settings.VERSION
    if key == "EXPIRY_THRESHOLD":
        threshold_days = os.getenv('EXPIRY_THRESHOLD_DAYS', 30)
        return threshold_days

@register.filter()
def comma_to_dot(value):
    return str(value).replace(',', '.')

@register.filter
def is_image_file(filename):
    if not filename:
        return False
    return bool(re.search(r'\.(jpg|jpeg|png)$', filename.lower()))


def clamp(value, min_value=0, max_value=255):
    return max(min_value, min(value, max_value))

@register.filter
def darken(hex_color, amount=20):
    """
    Darkens a hex color by a given integer amount (default: 20).
    Use: {{ "#ff0000"|darken:"30" }}
    """
    try:
        hex_color = hex_color.strip().lstrip('#')

        # Special case for default color
        if hex_color in ['1e1e1e', '1E1E1E']:
            return '#2a2a2a'

        # Handle shorthand like #abc
        if len(hex_color) == 3:
            hex_color = ''.join([c*2 for c in hex_color])

        # Strip any trailing % signs from amount
        if isinstance(amount, str):
            amount = re.sub(r'[^0-9]', '', amount)

        amount = int(amount)

        r = int(hex_color[0:2], 16)
        g = int(hex_color[2:4], 16)
        b = int(hex_color[4:6], 16)

        r = clamp(r - amount)
        g = clamp(g - amount)
        b = clamp(b - amount)

        return f'rgb({r}, {g}, {b})'
    except Exception:
        return f'rgb(30, 30, 30)'  # fallback to a safe default