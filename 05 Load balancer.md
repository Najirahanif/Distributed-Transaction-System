You should use a **LoadBalancer Service** when you want to expose a Kubernetes service outside the cluster using a stable external IP.

For your Kind cluster, the important point is:

> **Kind creates the Kubernetes cluster, but it does not provide a LoadBalancer implementation. MetalLB provides that missing functionality.**

So your architecture becomes:

```text
Client
  |
  v
External IP: 172.x.x.x
  |
  v
MetalLB
  |
  v
Kubernetes Service
  |
  v
Order Service Pods
```

## Why use `LoadBalancer`?

For your project, it is useful to understand the difference:

| Type           | Use                                                  |
| -------------- | ---------------------------------------------------- |
| `ClusterIP`    | Internal communication only                          |
| `NodePort`     | Expose service using a node port                     |
| `LoadBalancer` | Expose service through an external IP                |
| `Ingress`      | Route multiple HTTP services through one entry point |

Your current setup:

```text
order-service      → LoadBalancer
inventory-service  → NodePort
payment-service    → NodePort
```

is fine for learning and testing the different Service types.

---

# Exact steps for your Kind cluster

## Step 1: Verify you are using Kind

```bash
kind get clusters
```

Then:

```bash
kubectl config current-context
```

You should see something similar to:

```text
kind-ecommerce-cluster
```

---

## Step 2: Check your Kind network

Run:

```bash
docker network inspect kind
```

Find:

```json
"Subnet": "172.18.0.0/16"
```

Your actual subnet may be different. **Use your actual subnet.**

For example, if you see:

```text
172.18.0.0/16
```

then use an unused IP range such as:

```text
172.18.250.200-172.18.250.250
```

---

## Step 3: Install MetalLB

Run:

```bash
kubectl apply -f https://raw.githubusercontent.com/metallb/metallb/v0.15.3/config/manifests/metallb-native.yaml
```

Wait for MetalLB:

```bash
kubectl wait \
  --namespace metallb-system \
  --for=condition=available \
  deployment/controller \
  --timeout=120s
```

Check:

```bash
kubectl get pods -n metallb-system
```

You should see:

```text
controller   Running
speaker      Running
```

---

## Step 4: Create the IP pool

Create a file:

```text
metallb-config.yaml
```

If your Kind subnet is:

```text
172.18.0.0/16
```

use:

```yaml
apiVersion: metallb.io/v1beta1
kind: IPAddressPool
metadata:
  name: kind-pool
  namespace: metallb-system
spec:
  addresses:
    - 172.18.250.200-172.18.250.250

---
apiVersion: metallb.io/v1beta1
kind: L2Advertisement
metadata:
  name: kind-advertisement
  namespace: metallb-system
```

Apply:

```bash
kubectl apply -f metallb-config.yaml
```

Verify:

```bash
kubectl get ipaddresspool -n metallb-system
kubectl get l2advertisement -n metallb-system
```

---

## Step 5: Make sure your Service is `LoadBalancer`

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

  type: LoadBalancer
```

Apply it:

```bash
kubectl apply -f order-service.yaml
```

---

## Step 6: Check the external IP

```bash
kubectl get svc order-service -n ecommerce
```

Before MetalLB:

```text
EXTERNAL-IP   <pending>
```

After MetalLB:

```text
EXTERNAL-IP   172.18.250.200
```

This is the important verification:

```text
LoadBalancer service
        ↓
External IP assigned
        ↓
Not <pending>
```

---

## Step 7: Test the LoadBalancer

```bash
curl http://172.18.250.200:3001
```

If your application has a health endpoint:

```bash
curl http://172.18.250.200:3001/health
```

You can also watch the IP assignment:

```bash
kubectl get svc order-service -n ecommerce -w
```

---

# Add it to your Jenkins pipeline

You can add a stage before deploying your application:

```groovy
stage('Configure MetalLB') {
    steps {
        dir('order-service') {
            sh '''
                kubectl apply -f metallb-config.yaml
            '''
        }
    }
}
```

Then your order deployment:

```groovy
stage('Deploy Order Service') {
    steps {
        dir('order-service') {
            sh '''
                kubectl apply -f order-deployment.yaml
                kubectl apply -f order-service.yaml
            '''
        }
    }
}
```

But be precise about the workflow:

```text
Kind cluster
    ↓
Install MetalLB       ← one-time infrastructure setup
    ↓
Configure IP pool     ← one-time infrastructure setup
    ↓
Jenkins pipeline
    ↓
Deploy order-service
    ↓
LoadBalancer gets external IP
```

**Do not recreate your Kind cluster inside every Jenkins build.** That would destroy your Kubernetes resources.

Also, one correction to your current approach: if your actual goal is to expose **all three microservices through one public entry point**, then `LoadBalancer` for every service is not the best design. Use one external LoadBalancer with an Ingress Controller, and keep `order-service`, `payment-service`, and `inventory-service` as `ClusterIP`. But if your goal right now is specifically to **learn and verify how a Kubernetes `LoadBalancer` works**, the MetalLB steps above are the correct path.



Do this now
## 1. Delete the completed Pod
kubectl delete pod test-client

Verify:

kubectl get pod test-client

You should get:

Error from server (NotFound)
## 2. Create a new long-running Pod
kubectl run test-client \
  --image=curlimages/curl \
  --restart=Never \
  --command -- sleep 300

Wait until:

kubectl get pod test-client

shows:

READY   STATUS
1/1     Running
## 3. Run your 10 requests
for i in {1..10}; do
  kubectl exec test-client -- \
    curl -s http://172.18.250.200:3001/health/ready
  echo
done

Now it will work because the Pod is still running.

## 4. Delete the test Pod afterward
kubectl delete pod test-client



this works only inside the kubernetes not on your mac
