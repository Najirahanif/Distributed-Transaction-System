Need to do this setup for the metric server

Run:

```bash
kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml
```

Then, because you are using a local **kind** cluster, patch it:

```bash
kubectl patch deployment metrics-server \
  -n kube-system \
  --type='json' \
  -p='[{"op":"add","path":"/spec/template/spec/containers/0/args/-","value":"--kubelet-insecure-tls"}]'
```

Check:

```bash
kubectl get pods -n kube-system | grep metrics-server
```

Wait until:

```text
metrics-server-xxxxx   1/1   Running
```

Then:

```bash
kubectl top pods -n ecommerce
```

If you specifically want a local file named `metrics-server.yaml`, download the official manifest:

```bash
curl -o metrics-server.yaml \
https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml
```

Then:

```bash
kubectl apply -f metrics-server.yaml
```

For your current **kind local cluster**, the fastest method is the first one.
