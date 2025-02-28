#!/bin/bash

npm run build
./init.sh
env HASS_URL="https://ha.oleander.io" HASS_TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJlMDYzMDE5ZTNlZTk0ZjQwOTQ1ZDIzYzU4ZTgxZjQxNCIsImlhdCI6MTc0MDc2MTQ0MCwiZXhwIjoyMDU2MTIxNDQwfQ.8H2P699Rr3iIOQd8jzo0Hq3Om2vey9qBWywyLYCQMgM" HASS_WEBSOCKET="true" hass-mcp --stdio


