from django import forms
from .models import *
import os
import qrcode
from io import BytesIO
from django.http import HttpResponse
import apprise
from django import forms
from .models import *
from django.utils.translation import gettext_lazy as _
from datetime import timedelta
from django.utils import timezone

class ItemForm(forms.ModelForm):
    file = forms.FileField(required=False)
    value_type = forms.CharField(widget=forms.HiddenInput(), initial='money')
    tile_color = forms.CharField(
        required=False,
        widget=forms.TextInput(attrs={'type': 'color', 'class': 'form-control form-control-color'}),
        label=_('Tile Color')
    )

    class Meta:
        model = Item
        fields = ['name', 'issuer', 'redeem_code', 'pin', 'issue_date', 'expiry_date', 'description', 'logo_slug', 'type', 'value', 'value_type', 'file', 'code_type', 'tile_color']
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

        # Make expiry_date optional
        self.fields['expiry_date'].required = False

    def clean_file(self):
        file = self.cleaned_data.get('file')
        
        if file:
            allowed_content_types = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf']
            allowed_extensions = ['.jpeg', '.jpg', '.png', '.pdf']

            # Check content type
            if hasattr(file, 'content_type'):
                if file.content_type not in allowed_content_types:
                    raise forms.ValidationError(_('File type is not supported.'))

            # Check file extension
            ext = os.path.splitext(file.name)[1].lower()
            if ext not in allowed_extensions:
                raise forms.ValidationError(_('File extension is not supported.'))

            # Check file size
            if file.size > 5 * 1024 * 1024:  # 5MB
                raise forms.ValidationError(_('File size is too large.'))

        return file

    def clean(self):
        cleaned_data = super().clean()
        item_type = cleaned_data.get('type')
        value_type = cleaned_data.get('value_type')
        value = cleaned_data.get('value')
        expiry_date = cleaned_data.get('expiry_date')

        # Set expiry_date to 50 years in the future if not provided
        if not expiry_date:
            cleaned_data['expiry_date'] = timezone.now() + timedelta(days=50*365)  # 50 years in the future

        if item_type == 'loyaltycard' and value != 0:
            error_msg_value = _('Value must be zero for loyalty cards.')
            raise forms.ValidationError(error_msg_value)
        if item_type == 'coupon':
            if value_type == 'money':
                if value is None or value < 0:
                    raise forms.ValidationError(_('Value must be a positive monetary amount.'))
            elif value_type == 'percentage':
                if value is None or value < 0 or value > 100:
                    raise forms.ValidationError(_('Percentage value must be between 0 and 100.'))
            elif value_type == 'multiplier':
                if value is None or value < 1:
                    raise forms.ValidationError(_('Multiplier must be 1 or higher.'))
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

class UserPreferenceForm(forms.ModelForm):
    class Meta:
        model = UserPreference
        fields = ['show_issue_date', 'show_expiry_date', 'show_value', 'show_description']
        widgets = {
            'show_issue_date': forms.CheckboxInput(attrs={'class': 'form-check-input'}),
            'show_expiry_date': forms.CheckboxInput(attrs={'class': 'form-check-input'}),
            'show_value': forms.CheckboxInput(attrs={'class': 'form-check-input'}),
            'show_description': forms.CheckboxInput(attrs={'class': 'form-check-input'}),
        }