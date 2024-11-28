from django.db import models
from django.utils import timezone
from django.contrib.auth.models import User
from django.core.exceptions import ValidationError
import uuid

class Item(models.Model):
    ITEM_TYPES = (
        ('voucher', 'Voucher'),
        ('giftcard', 'Gift Card'),
        ('coupon', 'Coupon'),
        ('loyaltycard', 'Loyalty Card'),
    )
    VALUE_TYPES = (
        ('money', 'Money'),
        ('percentage', 'Percentage'),
    )    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    type = models.CharField(max_length=50, choices=ITEM_TYPES)
    name = models.CharField(max_length=255)
    redeem_code = models.CharField(max_length=50)
    pin = models.CharField(max_length=10, blank=True, null=True)
    issuer = models.CharField(max_length=50)
    issue_date = models.DateField(default=timezone.now)
    expiry_date = models.DateField()
    description = models.TextField(blank=True, null=True)
    logo_slug = models.CharField(max_length=50, blank=True, null=True, default=None)
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    value = models.DecimalField(max_digits=10, decimal_places=2)
    value_type = models.CharField(max_length=20, choices=VALUE_TYPES, default='money')
    is_used = models.BooleanField(default=False)
    qr_code_base64 = models.TextField(blank=True, null=True)
    file = models.FileField(upload_to='database/', blank=True, null=True)

    def __str__(self):
        return self.name

class ItemShare(models.Model):
    item = models.ForeignKey(Item, on_delete=models.CASCADE, related_name='shared_with')
    shared_with_user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='received_items')
    shared_at = models.DateTimeField(auto_now_add=True)
    shared_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name='shared_items')

    class Meta:
        unique_together = ('item', 'shared_with_user')

class Transaction(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    item = models.ForeignKey(Item, on_delete=models.CASCADE, related_name='transactions')
    date = models.DateTimeField(auto_now_add=True)
    description = models.CharField(max_length=255)
    value = models.DecimalField(max_digits=10, decimal_places=2)

    def __str__(self):
        return f"{self.description} ({self.value})"      

class UserProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE)
    apprise_urls = models.TextField(blank=True, null=True)

    def __str__(self):
        return self.user.username

class AppSettings(models.Model):
    """
    Model for storing API token for authentication.

    This model enforces a singleton pattern to ensure only one set of API settings exists.
    The API token is used for authenticating API requests.

    API Usage:
    - Endpoint: /en/api/get/stats
    - Method: GET
    - Authorization: Requires an API token provided in the `Authorization` header
      in the format: `Authorization: Bearer <API-TOKEN>`
    - Description: Retrieves statistical data about items, users, and issuers.

    Example:
    ```
    curl -H "Authorization: Bearer <API-TOKEN>" http://<your-domain>/api/get/stats
    ```

    Attributes:
    - api_token: A unique token used for API authentication.
    - updated_at: Timestamp of the last update to the API token.

    Methods:
    - regenerate_api_token: Generates a new API token and updates the `updated_at` field.
    """

    api_token = models.CharField(max_length=64, default=uuid.uuid4, unique=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "API Settings"
        verbose_name_plural = "API Settings"

    def regenerate_api_token(self):
        """Generate a new API token."""
        self.api_token = str(uuid.uuid4())  # Ensure it's saved as a string
        self.save()

    def save(self, *args, **kwargs):
        """Override save to enforce singleton behavior and validate the API token."""
        # Ensure only one instance exists
        if not self.pk and AppSettings.objects.exists():
            raise ValueError("Only one AppSettings instance is allowed.")

        # Validate the API token is a valid UUID
        if not isinstance(self.api_token, str):
            self.api_token = str(self.api_token)  # Convert to string if it's a UUID object
        try:
            uuid_obj = uuid.UUID(self.api_token)  # Validate if it's a valid UUID string
            self.api_token = str(uuid_obj)  # Normalize to UUID string format
        except ValueError:
            raise ValueError("The API token must be a valid UUID.")

        super().save(*args, **kwargs)

    def __str__(self):
        return f"API Token (Updated: {self.updated_at})"

