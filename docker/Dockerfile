FROM python:3.10.12-slim

ARG VERSION=0
ENV VERSION=$VERSION
ARG BRANCH=0
ENV BRANCH=$BRANCH

# update and install software + create necessary dirs
RUN apt-get update && apt-get install -y --no-install-recommends \
    nginx \
    nano \
    gnupg \
    cron \
    ghostscript \
    gcc \
    mime-support \
    unzip &&\
    mkdir -p /opt/app/docker/ /opt/app/database /opt/app/logs

# define workdir
WORKDIR /opt/app

# copy relevant source data
COPY myproject /opt/app/myproject
COPY myapp /opt/app/myapp
COPY manage.py /opt/app/manage.py
COPY requirements.txt /opt/app/requirements.txt
COPY /docker/entrypoint.sh /opt/app/docker/entrypoint.sh

# fix dependencies, permissions and openssl
RUN pip install --upgrade pip && \
    pip3 install -r requirements.txt --cache-dir /opt/app/pip_cache && \
    pip3 install uwsgi -I --no-cache-dir && \
    chown -R www-data:www-data /opt/app && \
    chmod -R 770 /opt/app && \
    chmod +x /opt/app/docker/entrypoint.sh
    
# run container as low privileged user
USER www-data

# start uwsgi server
ENTRYPOINT ["/opt/app/docker/entrypoint.sh"]
EXPOSE 8000
STOPSIGNAL SIGTERM
