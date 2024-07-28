from django.shortcuts import redirect
from django.urls import resolve, Resolver404
from functools import wraps

def auth_required(view_func):
    @wraps(view_func)
    def _wrapped_view(request, *args, **kwargs):
        if not request.user.is_authenticated:
            # Extract the requested URL
            next_url = request.get_full_path()
            # Validate the URL against the URL patterns
            try:
                resolve(next_url)
            except Resolver404:
                next_url = '/'
            # Redirect to the admin login page with the 'next' parameter
            return redirect(f'/accounts/login/?next={next_url}')
        return view_func(request, *args, **kwargs)
    return _wrapped_view
