# Generated by Django 5.2 on 2025-06-23 10:57

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('myapp', '0019_userpreference'),
    ]

    operations = [
        migrations.AddField(
            model_name='userpreference',
            name='show_value',
            field=models.BooleanField(default=True),
        ),
    ]
