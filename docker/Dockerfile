FROM python:3.12.11-slim

# define environment
ARG VERSION=0
ENV VERSION=$VERSION
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# update and install software + create necessary dirs
RUN apt-get update && apt-get install -y --no-install-recommends \
    cron \
    ghostscript \
    gcc \
    libc6-dev \
    netcat-openbsd \
    media-types \
    postgresql-client \
    unzip &&\
    mkdir -p /opt/app/docker/ /opt/app/database /opt/app/logs /opt/app/locale

# define workdir
WORKDIR /opt/app

# copy relevant source code
COPY myproject /opt/app/myproject
COPY myapp /opt/app/myapp
COPY manage.py /opt/app/manage.py
COPY requirements.txt /opt/app/requirements.txt
COPY /docker/entrypoint.sh /opt/app/docker/entrypoint.sh
COPY /docker/docker_uwsgi.ini /opt/app/docker/docker_uwsgi.ini
COPY locale /opt/app/locale

# install dependencies, fix permissions
RUN pip install --upgrade pip && \
    pip3 install -r requirements.txt --cache-dir /opt/app/pip_cache && \
    chown -R www-data:www-data /opt/app && \
    chmod -R 770 /opt/app && \
    chmod +x /opt/app/docker/entrypoint.sh
    
# run container as low privileged user
USER www-data

# start web server
ENTRYPOINT ["/opt/app/docker/entrypoint.sh"]
EXPOSE 8000
STOPSIGNAL SIGTERM
