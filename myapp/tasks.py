# myapp/tasks.py
from celery import shared_task
from django.core.management import call_command

@shared_task
def run_expiration_check():
    call_command('check_expiration')
