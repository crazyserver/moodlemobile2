#!/bin/bash

if [ $TRAVIS_EVENT_TYPE == 'cron' ]  ; then
    ./scripts/tests.sh
else
    ./scripts/aot.sh
fi
