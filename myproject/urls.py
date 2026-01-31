"""myproject URL Configuration

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/3.2/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import include, path
from django.contrib.auth import views as auth_views
from django.conf import settings
from django.conf.urls.i18n import i18n_patterns
from myapp import views as myapp_views

urlpatterns = i18n_patterns(
    path('admin/', admin.site.urls),
    path("", include("myapp.urls")),
    # Override login BEFORE including django.contrib.auth.urls
    path("accounts/login/", myapp_views.smart_login, name="login"),
    path('accounts/', include('django.contrib.auth.urls')),  # This now won't override your custom login
    path("i18n/", include("django.conf.urls.i18n")),
)

# Conditionally include OIDC URLs if OIDC_ENABLED is False
if not settings.OIDC_ENABLED:
    urlpatterns.append(path('accounts/password_change/', auth_views.PasswordChangeView.as_view(template_name='registration/password_change_form.html'), name='password_change'))
    urlpatterns.append(path('accounts/password_change/done/', auth_views.PasswordChangeDoneView.as_view(template_name='registration/password_change_done.html'), name='password_change_done'))

# Conditionally include OIDC URLs if OIDC_ENABLED is True
if settings.OIDC_ENABLED:
    urlpatterns.append(path('oidc/', include('mozilla_django_oidc.urls')))