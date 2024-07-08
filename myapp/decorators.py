from django.shortcuts import redirect
from functools import wraps

def auth_required(view_func):
    def _wrapped_view(request, *args, **kwargs):
        if not request.user.is_authenticated:
            # Redirect to the admin login page with the 'next' parameter
            return redirect('/admin/login/?next=/')
        return view_func(request, *args, **kwargs)
    return _wrapped_view