from django import forms
from .models import *
import qrcode
from io import BytesIO
from django.http import HttpResponse
import apprise
from django import forms
from .models import *

def send_notifications():
    now = timezone.now().date()
    soon = now + timezone.timedelta(days=200)
    expiring_vouchers = Voucher.objects.filter(expiry_date__lte=soon)

    apobj = apprise.Apprise()
    # Add your notification services here
    apobj.add('mailto://your_email@example.com')

    for voucher in expiring_vouchers:
        apobj.notify(
            body=f'The voucher "{voucher.name}" is expiring soon!',
            title='Voucher Expiry Notification'
        )    

class ItemForm(forms.ModelForm):
    class Meta:
        model = Item
        fields = ['name', 'issuer', 'redeem_code', 'issue_date', 'expiry_date', 'description', 'type', 'value']
        widgets = {
            'issue_date': forms.DateInput(attrs={'type': 'date'}, format='%Y-%m-%d'),
            'expiry_date': forms.DateInput(attrs={'type': 'date'}, format='%Y-%m-%d'),
        }
    
    def clean_value(self):
        value = self.cleaned_data.get('value')
        if value <= 0:
            raise forms.ValidationError("Value must be positive.")
        return value

class UserProfileForm(forms.ModelForm):
    class Meta:
        model = UserProfile
        fields = ['apprise_urls']
        widgets = {
            'apprise_urls': forms.Textarea(
                attrs={
                    'rows': 3,
                    'class': 'form-control',  # Add Bootstrap class for full width
                    'placeholder': 'tgram://bottoken1/ChatID1,tgram://bottoken2/ChatID2'
                }
            ),
        }