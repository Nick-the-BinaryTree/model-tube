#!/bin/bash

# This is necessary so boot2docker doesn't create the folders later with root
# ownership.

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

mkdir -p ${DIR}/mysql/data
mkdir -p ${DIR}/mysql/log
mkdir -p ${DIR}/elasticsearch/data
mkdir -p ${DIR}/elasticsearch/logs

# Elasticsearch requires more vm memory than Linux default
sudo sysctl -w vm.max_map_count=262144

# $UID is a shell variable that docker-compose.linux.yml needs. Exporting it as
# an environment variable so docker-compose.linux.yml can see it.
export UID
docker-compose -f docker-compose.yml -f docker-compose.linux.yml up "$@"
