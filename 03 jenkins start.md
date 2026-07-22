```bash
dont run any docker 
just open the docker 

*** open the http://localhost:8080 ***

## then start deploying

***kafka issue****
## if any kafka issue  
## 1. Check your cluster
kind get clusters

Then:

kubectl config current-context
kubectl cluster-info
## 2. If your cluster is microservices

Try:
kubectl config use-context kind-microservices

Then:
kubectl get nodes

## If this works:

kubectl logs deployment/kafka -n ecommerce

then again deploy


*** check the replicas ***
In Headlamp
Open Headlamp.
Select your Kubernetes cluster.
Go to Namespaces.
Select the ecommerce namespace.
Open Workloads → Deployments.
Click order-service.
Check Replicas — it should show 3 desired / 3 available.
Go to Pods and filter/search for order-service.

#1. Check the current Pods
kubectl get pods -n ecommerce

Example:

order-service-abc123   1/1   Running
order-service-def456   1/1   Running
order-service-ghi789   1/1   Running

#2. Delete one Pod
kubectl delete pod order-service-abc123 -n ecommerce

Replace order-service-abc123 with the actual Pod name.

#3. Immediately check again
kubectl get pods -n ecommerce -wz
```