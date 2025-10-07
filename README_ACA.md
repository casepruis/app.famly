# Handy commands 

```
# See backend FQDN (Fully Qualified Domain Name) 
az containerapp show -g <RG> -n <BACKEND_APP> `
  --query properties.configuration.ingress.fqdn -o tsv

# Point FE to backend by name (same env)
az containerapp update -g <RG> -n <FRONTEND_APP> `
  --env-vars API_URL=http://<BACKEND_APP>

```
