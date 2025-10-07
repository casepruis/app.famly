1)  Step 1 Build & push images to Azure Container Registry (ACR)
# ==== Set once (pick your names/region) ====
$RG="rg-famly-pilot"
$LOC="westeurope"
$ACR_NAME="famlyacr"        
$FE_IMG="famly-fe"
$BE_IMG="famly-be"
$FE_TAG="v9"
$BE_TAG="v3"

$ENV        = "env-famly"
$BE_APP     = "famly-backend"
$FE_APP     = "famly-frontend"
$BE_PORT    = 8000
$PGHOST     = "pg-famly-pilot.private.postgres.database.azure.com"
$PGPORT     = "5432"
$PGDATABASE = "pilot"
$PGUSER     = "famly-backend-mi"      # DB role you’ll create/grant in Postgres

$REGISTRY_SERVER = az acr show -n $ACR_NAME -g $RG --query loginServer -o tsv
$REGISTRY_SERVER  # prints like: famlyacr34871.azurecr.io

# 2) Step 2 — Rebuild & push the frontend image
# ==== Create resource group + ACR (once) ====
# az group create -n $RG -l $LOC
# az acr create -n $ACR -g $RG --sku Basic
# az acr login -n $ACR_NAME

# FE
az acr build --registry $ACR_NAME --image "${FE_IMG}:${FE_TAG}" .


# Build and push the images to ACR

# Step 4 — Deploy the frontend (external) and point to backend by app name

# az containerapp create `
#   -g $RG -n $FE_APP --environment $ENV `
#   --image "$REGISTRY_SERVER/${FE_IMG}:${FE_TAG}" `
#   --registry-server $REGISTRY_SERVER --registry-identity system `
#   --ingress external --target-port 8080 `
#   --cpu 0.25 --memory 0.5Gi `
#   --env-vars API_URL="http://$BE_APP"

# # Get public URL
# az containerapp show -g $RG -n $FE_APP --query properties.configuration.ingress.fqdn -o tsv



# 3) Step 3 — Deploy the new image to the frontend app

$BE_FQDN = az containerapp show -g $RG -n $BE_APP --query "properties.configuration.ingress.fqdn" -o tsv
$BE_FQDN
# expect something like: famly-backend.internal.blackwater-8e8c1104.westeurope.azurecontainerapps.io

# $API_URL = "http://${BE_FQDN}:8000"
# IMPORTANT: Use https and NO :8000
$API_URL = "https://$BE_FQDN"


# update env; also bump a dummy var to force a new revision so entrypoint re-runs envsubst
$REV = [string](Get-Date -UFormat %s)
az containerapp update -g $RG -n $FE_APP `
  --image "$REGISTRY_SERVER/${FE_IMG}:${FE_TAG}" `
  --set-env-vars API_URL="$API_URL" _REV="$REV" `
  --min-replicas 1

4) Step 4 — Test from your machine
$FE_FQDN = az containerapp show -g $RG -n $FE_APP --query "properties.configuration.ingress.fqdn" -o tsv
$FE_FQDN

curl.exe -i -v --max-time 10 "https://$FE_FQDN/api/docs"

# verify if nginx picked it up
az containerapp show -g $RG -n $FE_APP --query "properties.template.containers[0].env" -o jsonc


az containerapp exec -g $RG -n $FE_APP --command "sh -lc 'grep proxy_pass /etc/nginx/nginx.conf'"

az containerapp exec -g $RG -n $FE_APP --command "sh -lc 'grep -n \"proxy_pass\" /etc/nginx/nginx.conf'"

# Make sure the frontend is externally reachable; backend stays internal.
az containerapp update -g $RG -n $FE_APP `
  --ingress external --target-port 8080 `
  --set-env-vars API_URL="$API_URL"

1) Inspect revisions and replica counts
# List revisions with traffic + current replicas
az containerapp revision list -g $RG -n $FE_APP `
  --query "[].{name:name,active:active,weight:trafficWeight,replicas:replicasSummary.current}" -o table

# See the latest revision’s state (replace <REV> with the first row from above if needed)
$REV_NAME = az containerapp revision list -g $RG -n $FE_APP --query "[0].name" -o tsv
az containerapp revision show -g $RG -n $FE_APP --revision $REV_NAME -o jsonc