from functools import wraps
from django.http import HttpResponseForbidden
from myapp.models import *
import logging

logger = logging.getLogger(__name__)

def require_authorization_header_with_api_token(view_func):
    @wraps(view_func)
    def _wrapped_view(request, *args, **kwargs):
        # Get the latest AppSettings object from the database
        app_settings = AppSettings.objects.last()
        if not app_settings:
            logger.error('No API key configured. Returning 403 Forbidden.')
            return HttpResponseForbidden("Unauthorized. Invalid or missing authorization token.")

        # Retrieve the API token from AppSettings
        api_token = app_settings.api_token

        # Get the Authorization header from the request
        authorization_header = request.META.get('HTTP_AUTHORIZATION')

        # Check if the Authorization header is present and matches the API token
        if authorization_header != f'Bearer {api_token}':
            logger.info('Request with invalid or missing API token. Returning 403 Forbidden.')
            return HttpResponseForbidden("Unauthorized. Invalid or missing authorization token.")

        # Token is valid; proceed with the request
        return view_func(request, *args, **kwargs)

    return _wrapped_view
