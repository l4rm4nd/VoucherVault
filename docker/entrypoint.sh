#!/bin/bash

# Function to generate a random string
generate_random_string() {
    LC_ALL=C tr -dc 'a-zA-Z0-9' < /dev/urandom | head -c 20
}

# Wait for PostgreSQL database
if [ "$DB_ENGINE" = "postgres" ]; then
    echo "[i] Waiting for PostgreSQL db..."

    while ! nc -z $POSTGRES_HOST $POSTGRES_PORT; do
      sleep 0.1
    done

    echo "[i] PostgreSQL started"
fi

# Function to perform database migrations and initialization
perform_migrations() {
    echo "[~] Migrating changes to the database"
    python manage.py makemigrations
    python manage.py makemigrations myapp
    python manage.py migrate
    python manage.py migrate myapp

    if [ -z "$DB_INITIALIZED" ]; then
        echo "[~] Creating periodic tasks for expiry notifications."
        python manage.py create_default_periodic_tasks
        echo "------------------------------------"
        admin_password=$(generate_random_string)
        echo "[!!] Creating admin superuser account"
        echo "from django.contrib.auth.models import User; User.objects.create_superuser('admin', 'admin@example.com', '$admin_password')" | python manage.py shell
        echo "[>] Randomly generated password: $admin_password"
        echo "------------------------------------"
    fi
}

# Check for prior database init
if [ "$DB_ENGINE" = "sqlite3" ]; then
    if test -f "/opt/app/database/db.sqlite3"; then
        echo "[i] SQLite3 database found. Skipping initialization."
        DB_INITIALIZED=true
    fi
elif [ "$DB_ENGINE" = "postgres" ]; then
    if PGPASSWORD=$POSTGRES_PASSWORD psql -h $POSTGRES_HOST -U $POSTGRES_USER -d $POSTGRES_DB -c '\dt' | grep -q 'django_migrations'; then
        echo "PostgreSQL database found. Skipping initialization."
        DB_INITIALIZED=true
    fi
fi

# Perform database migrations
perform_migrations

# Start Django-Celery-Beat
echo "[~] Starting Celery worker and beat"
celery -A myproject worker -l info --detach
celery -A myproject beat -l info --detach --scheduler django_celery_beat.schedulers:DatabaseScheduler

# Spawn the web server
echo "[~] Spawning the application server"
python manage.py runserver 0.0.0.0:8000 --insecure
