# yourapp/management/commands/create_default_periodic_tasks.py
from django.core.management.base import BaseCommand
from django_celery_beat.models import PeriodicTask, CrontabSchedule

class Command(BaseCommand):
    help = 'Create default Celery Beat periodic tasks'

    def handle(self, *args, **options):
        # Create a crontab schedule (run every 10 days)
        crontab_schedule, created = CrontabSchedule.objects.get_or_create(
            minute='*/14400',
        )

        # Create default periodic tasks (disabled by default)
        tasks = [
            {'name': 'Periodic Expiry Check', 'task': 'myapp.tasks.run_expiration_check', 'crontab': crontab_schedule, 'enabled': True},
            # Add more tasks as needed
        ]

        for task_data in tasks:
            PeriodicTask.objects.get_or_create(
                name=task_data['name'],
                task=task_data['task'],
                crontab=task_data['crontab'],
                enabled=task_data.get('enabled', False),
            )

        self.stdout.write(self.style.SUCCESS('Default periodic tasks created successfully.'))