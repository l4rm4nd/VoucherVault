#!/bin/bash

echo "[i] The environment is set to ${ENV}"

# Function to generate a random string
generate_random_string() {
    LC_ALL=C tr -dc 'a-zA-Z0-9' < /dev/urandom | head -c 20
}

# if user provided a database file, skip db init
if test -f "/opt/app/database/db.sqlite3"; then
  echo "[~] Identified database file db.slite3. Skipping DB init."
  python manage.py makemigrations myapp
  python manage.py makemigrations
  python manage.py migrate
else
  echo "[~] Migrating changes to the database"
  python manage.py makemigrations myapp
  python manage.py makemigrations
  python manage.py migrate
  python manage.py create_default_periodic_tasks
  echo "------------------------------------"
  admin_password=$(generate_random_string)
  echo "[!!] Creating admin superuser account"
  echo "from django.contrib.auth.models import User; User.objects.create_superuser('admin', 'admin@example.com', '$admin_password')" | python manage.py shell
  echo "[>] Randomly generated password: $admin_password"
fi

#echo "[~] Starting Celery worker and beat"
celery -A myproject worker -l info --detach
celery -A myproject beat -l info --detach --scheduler django_celery_beat.schedulers:DatabaseScheduler
echo "[i] Change ownership of db.sqlite3 to www-data"
chown www-data: /opt/app/database/db.sqlite3
echo "[i] Spawning the application via UWSGI"
python manage.py runserver 0.0.0.0:8000 --insecure
