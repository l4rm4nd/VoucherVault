from django import forms
from .models import *
import qrcode
from io import BytesIO
from django.http import HttpResponse
import apprise
from django import forms
from .models import *
from django.utils.translation import gettext_lazy as _

class ItemForm(forms.ModelForm):
    file = forms.FileField(required=False)
    value_type = forms.CharField(widget=forms.HiddenInput(), initial='money')

    class Meta:
        model = Item
        fields = ['name', 'issuer', 'redeem_code', 'pin', 'issue_date', 'expiry_date', 'description', 'logo_slug', 'type', 'value', 'value_type', 'file']
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
                    error_msg_filetype = _('File type is not supported.')
                    error_msg_size = _('File size is too large.')
                    raise forms.ValidationError(error_msg_filetype)
                if file.size > 5*1024*1024:  # 5MB max size
                    raise forms.ValidationError(error_msg_size)
                return file

    def clean(self):
        cleaned_data = super().clean()
        item_type = cleaned_data.get('type')
        value_type = cleaned_data.get('value_type')
        value = cleaned_data.get('value')

        if item_type == 'loyaltycard' and value != 0:
            error_msg_value = _('Value must be zero for loyalty cards.')
            raise forms.ValidationError(error_msg_value)
        if item_type == 'coupon':
            if value_type == 'money' and (value is None or value < 0):
                error_message_value_positive_coupon = _('Value must be a positive monetary amount.')
                raise forms.ValidationError(error_message_value_positive_coupon)
            elif value_type == 'percentage' and (value is None or value < 0 or value > 100):
                error_message_percentage = _('Percentage value must be between 0 and 100.')
                raise forms.ValidationError(error_message_percentage)
        elif item_type != 'loyaltycard' and (value is None or value < 0):
            error_message_positive = _('Value must be positive.')
            raise forms.ValidationError(error_message_positive)
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
            error_msg_transaction = _('Transaction value must be negative.')
            raise forms.ValidationError(error_msg_transaction)
        
        if self.item:
            # Calculate the total value after applying this transaction
            total_value = self.item.value + sum(t.value for t in self.item.transactions.all()) + value
            if total_value < 0:
                error_msg_value_calc = _('Transaction would result in negative item value.')
                raise forms.ValidationError(error_msg_value_calc)
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