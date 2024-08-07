#!/bin/bash

# Function to generate a random string
generate_random_string() {
    LC_ALL=C tr -dc 'a-zA-Z0-9' < /dev/urandom | head -c 20
}

# Check read/write permissions on the /opt/app/database directory
echo "[TASK] Validating volume permissions"
if [ ! -w /opt/app/database ] || [ ! -r /opt/app/database ]; then
    echo "[FAIL] Insufficient permissions on bind mount volume. Exiting."
    echo "       > Ensure rw permissions for the www-data user/group."
    exit 1
else
    echo "[DONE] Permissions ok. Container can read and write database."
fi

# Wait for PostgreSQL database
if [ "$DB_ENGINE" = "postgres" ]; then
    echo "[TASK] Waiting for PostgreSQL db..."

    while ! nc -z $POSTGRES_HOST $POSTGRES_PORT; do
      sleep 0.1
    done

    echo "[DONE] PostgreSQL database available"
fi

# Function to perform database migrations and initialization
perform_migrations() {
    echo "[TASK] Migrating changes to the database"
    python manage.py makemigrations
    python manage.py makemigrations myapp
    python manage.py migrate
    python manage.py migrate myapp
    django-admin makemessages --all 2>&1 > /dev/null
    django-admin compilemessages 2>&1 > /dev/null
    echo ""

    if [ -z "$DB_INITIALIZED" ]; then
        echo "[TASK] Creating periodic tasks for expiry notifications."
        python manage.py create_default_periodic_tasks
        echo "-------------------------------------------------"
        admin_password=$(generate_random_string)
        echo "[TASK] Creating superuser account"
        echo "from django.contrib.auth.models import User; User.objects.create_superuser('admin', 'admin@example.com', '$admin_password')" | python manage.py shell
        echo "[>] username: admin"
        echo "[>] password: $admin_password"
        echo "-------------------------------------------------"
    fi
}

# Check for prior database init
if [ -z "$DB_ENGINE" ] || [ "$DB_ENGINE" = "sqlite3" ]; then
    if test -f "/opt/app/database/db.sqlite3"; then
        echo "[INFO] SQLite3 database found. Skipping initialization."
        DB_INITIALIZED=true
    fi
elif [ "$DB_ENGINE" = "postgres" ]; then
    if PGPASSWORD=$POSTGRES_PASSWORD psql -h $POSTGRES_HOST -U $POSTGRES_USER -d $POSTGRES_DB -c '\dt' | grep -q 'django_migrations'; then
        echo "[INFO] PostgreSQL database found. Skipping initialization."
        DB_INITIALIZED=true
    fi
fi

# Perform database migrations
perform_migrations

# Start Django-Celery-Beat
echo "[TASK] Starting Celery worker and beat"
celery -A myproject worker -l info --detach
celery -A myproject beat -l info --detach --scheduler django_celery_beat.schedulers:DatabaseScheduler

# Spawn the web server
echo "[TASK] Spawning the application server"
python manage.py runserver 0.0.0.0:8000 --insecure