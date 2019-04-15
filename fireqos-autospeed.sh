#!/bin/bash

if [[ "$UID" != "0" ]]; then
  echo "Must run as root!"
  exit
fi

service_running="$(systemctl is-active fireqos)"

if [[ "$service_running" != "active" ]]; then
  echo "FireQOS is not running - refusing to update and restart"
  exit
fi

echo "Running speedtest..."

script_dir="$(dirname $0)"
input_tpl="${1:-$script_dir/fireqos.conf.tpl}"
output="/usr/local/etc/firehol/fireqos.conf"
json="$(speedtest-cli --json)"
down_speed="$(echo $json | jq .download)"
up_speed="$(echo $json | jq .upload)"
down_limit="$(echo "scale = 0; ($down_speed * 0.85) / 1000" | bc -l)kbit"
up_limit="$(echo "scale = 0; ($up_speed * 0.95) / 1000" | bc -l)kbit"
timestamp="$(date "+%Y-%m-%d %H:%M:%S")"

echo "Updating download speed limit to ${down_limit}"
echo "Updating upload speed limit to ${up_limit}"

cat "$input_tpl" | sed -e "s/%DOWN_LIMIT%/$down_limit/g" \
  -e "s/%UP_LIMIT%/$up_limit/g" \
  -e "s|%TEMPLATE_PATH%|$input_tpl|g" \
  -e "s/%TIMESTAMP%/'$timestamp'/g" > "$output"

echo "Config file updated at $output"
echo "Restarting FireQOS..."

systemctl restart fireqos
