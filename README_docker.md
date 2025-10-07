
1) Install Docker Desktop (Windows)
Start Docker Desktop so docker commands work in PowerShell.
(WSL2 backend is recommended; the installer can enable it for you.)

2) Build the image
From your frontend root (where the Dockerfile is):

    ```docker build -t famly-fe:local .```

3) Run the container and point /api to your local backend

    When a container needs to reach a service on your Windows host, use host.docker.internal.

    ```
    docker run --rm -it -p 8080:8080 `
    -e API_URL=http://host.docker.internal:8000 `
    --name famly-fe famly-fe:local
    
    ```


    Open: http://localhost:8080

    Static site is served by NGINX on port 8080.

    Requests to /api/... inside the container get proxied to your host’s backend at http://host.docker.internal:8000/....

    Tip: if your backend uses a different port locally, change API_URL accordingly.

# FAQ:
1. Why not just docker compose up?

You can — and often should — use docker compose up.
The difference is:

docker build … && docker run … → You control each step manually (good to learn the basics).

docker compose up --build → Automates build + run together, supports multiple services (frontend + backend + db, etc.) with one YAML.

Since you eventually want frontend + backend + postgres all running, docker-compose.yml will be your friend. For now, I showed plain docker run so you’d see how environment variables, port mapping, and image names work under the hood.

👉 So: nothing wrong with docker compose. In fact, for your workflow I’d recommend switching to compose soon.

