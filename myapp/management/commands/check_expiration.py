# myapp/management/commands/check_expiration.py

from django.core.management.base import BaseCommand
from django.utils import timezone
from myapp.models import Item, UserProfile
import apprise
import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

class Command(BaseCommand):
    help = 'Send notifications for items that are about to expire'

    def handle(self, *args, **kwargs):
        # Get the threshold value from environment variable or use default (14 days)
        threshold_days = os.getenv('EXPIRY_THRESHOLD_DAYS', 14)
        try:
            threshold_days = int(threshold_days)
        except ValueError:
            self.stdout.write(self.style.ERROR('EXPIRY_THRESHOLD_DAYS environment variable is not a valid integer. Aborting.'))
            return

        # Define the time threshold (e.g., items expiring within the next threshold_days)
        threshold_date = timezone.now() + timezone.timedelta(days=threshold_days)
        current_date = timezone.now()
        
        # Get all user profiles with Apprise URLs
        user_profiles = UserProfile.objects.exclude(apprise_urls__isnull=True).exclude(apprise_urls__exact='')

        for profile in user_profiles:
            apprise_urls = profile.apprise_urls.split(',')
            expiring_items = Item.objects.filter(
                expiry_date__lte=threshold_date,
                expiry_date__gte=current_date,
                is_used=False,
                user=profile.user
            )

            if expiring_items.exists():
                # Initialize Apprise
                apobj = apprise.Apprise()
                
                for url in apprise_urls:
                    apobj.add(url.strip())

                # Prepare the notification message
                message = '<b>The following items are about to expire:</b>\n\n'
                message += '<pre>Type       Name              Expiry Date  Value</pre>\n'
                message += '<pre>---------- ----------------  -----------  -----</pre>\n'
                for item in expiring_items:
                    message += f'<pre>{item.type:<10} {item.name:<16}  {item.expiry_date.strftime("%Y-%m-%d")}  {item.value}</pre>\n'

                # Send the notification
                apobj.notify(
                    body=message,
                    title='⚠️ Expiring Items Notification',
                    notify_type=apprise.NotifyType.INFO,
                    body_format=apprise.NotifyFormat.MARKDOWN  # Use Markdown for better formatting
                )

                self.stdout.write(self.style.SUCCESS(f'Successfully sent notifications for user: {profile.user.username}'))
            else:
                self.stdout.write(self.style.SUCCESS(f'No items are expiring soon for user: {profile.user.username}'))
