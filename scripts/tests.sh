#!/bin/bash
source "scripts/functions.sh"

#print_title "Running unit tests"
#npm run test:ci

print_title "Running e2e behat tests"

gitfolder=${PWD##*/}

IONICHOSTNAME=ionic
NETWORK=moodle-docker_default

# Start it asap so we don't need to wait later.
print_title "Run local docker of the App"
docker build ./ -t app
docker run \
        --name ${IONICHOSTNAME} \
        --detach \
        app

print_title "Download repos"

# Moodle Set up
mkdir ~/moodle
git clone --depth 1 --no-single-branch -q https://github.com/moodle/moodle.git ~/moodle

pushd ~/moodle
git checkout master # Configure the desired version

print_title "Install and execute composer (avoid fail on behat init)"
php -r "copy('https://getcomposer.org/installer', 'composer-setup.php');"
php -r "if (hash_file('sha384', 'composer-setup.php') === 'baf1608c33254d00611ac1705c1d9958c817a1a33bce370c0595974b342601bd80b92a3f46067da89e3b06bff421f182') { echo 'Installer verified'; } else { echo 'Installer corrupt'; unlink('composer-setup.php'); } echo PHP_EOL;"
php composer-setup.php
php -r "unlink('composer-setup.php');"
php composer.phar install

print_title "Copy tests"
git clone --depth 1 --no-single-branch -q https://github.com/moodlehq/moodle-local_moodlemobileapp.git local/moodlemobileapp
popd

print_title "Download Moodle docker"
# Start Moodle docker
mkdir ~/moodle-docker
git clone --depth 1 --no-single-branch -q https://github.com/crazyserver/moodle-docker.git ~/moodle-docker

pushd ~/moodle-docker

# Set up path to Moodle code
export MOODLE_DOCKER_WWWROOT=~/moodle
export MOODLE_DOCKER_DB=pgsql
export MOODLE_DOCKER_BROWSER=chrome
export MOODLE_DOCKER_BEHAT_IONIC_WWWROOT="http://${IONICHOSTNAME}:8100"
export MOODLE_DOCKER_SELENIUM_VNC_PORT=5900
if [ ! -z "$SAUCE_USERNAME" ] && [ "$SAUCE_USERNAME" != 'null' ]; then
    export MOODLE_DOCKER_SELENIUM_ADDRESS="https://${SAUCE_USERNAME}:${SAUCE_ACCESS_KEY}@ondemand.saucelabs.com:443/wd/hub"
fi

# Ensure customized config.php for the Docker containers is in place
cp config.docker-template.php $MOODLE_DOCKER_WWWROOT/config.php

print_title "Start up containers"
# Start up containers. https://tracker.moodle.org/browse/MDL-65817
bin/moodle-docker-compose up -d

# Connect app to the network
docker network connect ${NETWORK} ${IONICHOSTNAME}

pushd ~/moodle-docker

print_title "Wait for DB to come up"
# Wait for DB to come up (important for oracle/mssql)
bin/moodle-docker-wait-for-db

echo "Waiting ionic to start..."
DOCKERIONIC=`docker inspect ionic | jq '.[].State.Health.Status'`
until [ '"healthy"' == $DOCKERIONIC ]  ; do
  echo "."
  sleep 10
  DOCKERIONIC=`docker inspect ionic | jq '.[].State.Health.Status'`
done

# Run behat
print_title "Re-initialize behat environment"

# Initialize behat environment
bin/moodle-docker-compose exec webserver php admin/tool/behat/cli/init.php

bin/moodle-docker-compose exec webserver cat  /var/www/behatdata/behatrun/behat/behat.yml

print_title "Run behat tests"
# Run behat tests
bin/moodle-docker-compose exec webserver php admin/tool/behat/cli/run.php --tags=@app

print_title "All done, shut down"
# Shut down and destroy containers
bin/moodle-docker-compose down

disown
killall npm