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
        fields = ['name', 'issuer', 'redeem_code', 'pin', 'issue_date', 'expiry_date', 'description', 'type', 'value']
        widgets = {
            'issue_date': forms.DateInput(attrs={'type': 'date'}, format='%Y-%m-%d'),
            'expiry_date': forms.DateInput(attrs={'type': 'date'}, format='%Y-%m-%d'),
        }
    
    def clean_value(self):
        value = self.cleaned_data.get('value')
        if value <= 0:
            raise forms.ValidationError("Value must be positive.")
        return value

class TransactionForm(forms.ModelForm):
    class Meta:
        model = Transaction
        fields = ['description', 'value']
    
    def __init__(self, *args, **kwargs):
        self.item = kwargs.pop('item', None)
        super(TransactionForm, self).__init__(*args, **kwargs)

    def clean_value(self):
        value = self.cleaned_data['value']
        if value >= 0:
            raise forms.ValidationError("Transaction value must be negative.")
        
        if self.item:
            # Calculate the total value after applying this transaction
            total_value = self.item.value + sum(t.value for t in self.item.transactions.all()) + value
            if total_value < 0:
                raise forms.ValidationError("Transaction would result in negative item value.")
        return value     

class UserProfileForm(forms.ModelForm):
    class Meta:
        model = UserProfile
        fields = ['apprise_urls']
        widgets = {
            'apprise_urls': forms.Textarea(
                attrs={
                    'rows': 3,
                    'class': 'form-control',
                    'placeholder': 'tgram://bottoken1/ChatID1,tgram://bottoken2/ChatID2'
                }
            ),
        }