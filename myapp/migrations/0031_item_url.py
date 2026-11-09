from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('myapp', '0030_transaction_date_editable'),
    ]

    operations = [
        migrations.AddField(
            model_name='item',
            name='url',
            field=models.URLField(blank=True, default=None, max_length=2048, null=True),
        ),
    ]
