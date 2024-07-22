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
    file = forms.FileField(required=False)

    class Meta:
        model = Item
        fields = ['name', 'issuer', 'redeem_code', 'pin', 'issue_date', 'expiry_date', 'description', 'type', 'value', 'file']
        widgets = {
            'issue_date': forms.DateInput(attrs={'type': 'date'}, format='%Y-%m-%d'),
            'expiry_date': forms.DateInput(attrs={'type': 'date'}, format='%Y-%m-%d'),
        }

    def __init__(self, *args, **kwargs):
        super(ItemForm, self).__init__(*args, **kwargs)
        if 'data' in kwargs:
            item_type = kwargs['data'].get('type')
            if item_type == 'loyaltycard':
                self.fields['value'].required = False
            else:
                self.fields['value'].required = True

    def clean_file(self):
        file = self.cleaned_data.get('file')
        if file:
            if hasattr(file, 'content_type'):
                if file.content_type not in ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf']:
                    raise forms.ValidationError('File type is not supported.')
                if file.size > 5*1024*1024:  # 5MB max size
                    raise forms.ValidationError('File size is too large.')
        return file

    def clean(self):
        cleaned_data = super().clean()
        item_type = cleaned_data.get('type')
        value = cleaned_data.get('value')
        if item_type == 'loyaltycard' and value != 0:
            raise forms.ValidationError("Value must be zero for loyalty cards.")
        if item_type != 'loyaltycard' and (value is None or value < 0):
            raise forms.ValidationError("Value must be positive.")
        return cleaned_data

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