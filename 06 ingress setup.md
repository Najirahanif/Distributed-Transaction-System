Yes. Now you can move to **Ingress** and use a domain name such as:

```text
distributed.service
```

But understand the architecture first:

```text
Browser / curl
      |
      | http://distributed.service
      v
Ingress Controller
      |
      | routing rule
      v
order-service
      |
      v
Order Pods
```

You **do not need MetalLB for this basic local Ingress setup**. The Ingress Controller itself becomes the entry point.

## Exact steps for Kind

### 1. Create a Kind cluster with port mapping

Your `kind-config.yaml` should contain:

```yaml
kind: Cluster
apiVersion: kind.x-k8s.io/v1alpha4

nodes:
  - role: control-plane
    extraPortMappings:
      - containerPort: 80
        hostPort: 80
        protocol: TCP

      - containerPort: 443
        hostPort: 443
        protocol: TCP

  - role: worker
```

If your existing cluster was created **without** these port mappings, you must recreate it:

```bash
kind delete cluster --name microservices
```

Then:

```bash
kind create cluster \
  --name microservices \
  --config kind-config.yaml
```

⚠️ This deletes your existing Kubernetes resources.

---

### 2. Install an Ingress Controller

For Kind, use the NGINX Ingress Controller:

```bash
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.13.2/deploy/static/provider/kind/deploy.yaml
```

Wait:

```bash
kubectl wait \
  --namespace ingress-nginx \
  --for=condition=ready pod \
  --selector=app.kubernetes.io/component=controller \
  --timeout=120s
```

Check:

```bash
kubectl get pods -n ingress-nginx
```

You should see:

```text
ingress-nginx-controller   Running
```

---

### 3. Make your Order Service internal

Your `order-service.yaml` should be:

```yaml
apiVersion: v1
kind: Service

metadata:
  name: order-service
  namespace: ecommerce

spec:
  selector:
    app: order-service

  ports:
    - port: 3001
      targetPort: 3001

  type: ClusterIP
```

The service does not need to be `LoadBalancer` anymore.

The Ingress Controller will route traffic to it.

---

### 4. Create an Ingress rule with a domain name

Create:

```text
order-ingress.yaml
```

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress

metadata:
  name: order-ingress
  namespace: ecommerce

spec:
  ingressClassName: nginx

  rules:
    - host: distributed.services

      http:
        paths:
          - path: /
            pathType: Prefix

            backend:
              service:
                name: order-service
                port:
                  number: 3001
```

Apply:

```bash
kubectl apply -f order-ingress.yaml
```

Check:

```bash
kubectl get ingress -n ecommerce
```

---

### 5. Map the domain name to localhost

Edit your Mac's hosts file:

```bash
sudo nano /etc/hosts
```

Add:

```text
127.0.0.1 distributed.services
```

Save:

```text
CTRL + O
ENTER
CTRL + X
```

Now your Mac resolves:

```text
distributed.services
```

to:

```text
127.0.0.1
```

---

### 6. Test your domain

Now run:

```bash
curl http://distributed.services/health/ready
```

Expected:

```json
{"status":"ready"}
```

Or open:

```text
http://distributed.services/health/ready
```

in your browser.

## Final architecture

```text
http://distributed.services/health/ready
              |
              v
        127.0.0.1:80
              |
              v
    NGINX Ingress Controller
              |
              | host = distributed.services
              v
        order-service
              |
              v
      Order Service Pods
```

For your microservices, you can later use:

```text
distributed.services       → order-service
payment.local     → payment-service
inventory.local   → inventory-service
```

or, more realistically:

```text
api.local/orders       → order-service
api.local/payments     → payment-service
api.local/inventory    → inventory-service
```

The second approach is better because you have **one domain and path-based routing**, rather than exposing a separate domain for every service.
