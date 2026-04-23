# How RCS Works

A simplified explanation of the system behind the RCS interface.

---

## The Big Picture

When you use RCS, your actions travel through several layers before anything happens on the actual server. Here is the path from your browser to your running application:

![Architecture diagram: You (Browser) → RCS Frontend → Capp Backend → Kubernetes Cluster → Capp Operator](images/architecture-diagram.svg)


### What each part does

**You (Browser)**
You interact with RCS through your web browser. Everything you do - creating a Capp, editing a Secret, checking status — starts here.

**RCS Frontend**
This is the web application itself. It displays your data, collects your input through forms, and sends your requests to the backend. It does not store your applications or configuration - it is a window into the system.

**Capp Backend**
The backend is the server that sits between the web app and your clusters. It has two jobs:
- **Access control** - it verifies your identity and makes sure you only see and change what you are allowed to.
- **Translation** - it converts your actions (like "create this Capp") into the technical instructions the cluster understands.

**Kubernetes Cluster**
This is the infrastructure where your applications actually run. A cluster is a pool of servers managed together. Your Capps, ConfigMaps, and Secrets all live here - not in your browser or on the backend.

**Capp Operator**
The operator is an automated system running inside the cluster. Once you create or update a Capp, the operator takes over. It:
- Starts your application containers
- Configures networking so your app is reachable
- Scales your app up or down based on the scale metric you chose
- Continuously monitors health and reports **Status Conditions** back to the UI

---

## Why You See a Cluster Picker

The backend can manage **multiple clusters** — for example, a development cluster and a production cluster. The cluster selector in the sidebar lets you choose which environment you are working with.

When you switch clusters:
- The data on screen reloads for the new cluster
- The namespace filter resets to **All Namespaces**
- Your login session stays active (you do not need to sign in again)

The health dot next to the cluster name tells you if the system can reach that cluster: **green** means connected and healthy, **red** means there may be an issue.

---

## Why You See a Namespace Selector

Inside each cluster, resources are organized into **namespaces**. Think of namespaces as separate folders — each team, project, or environment can have its own namespace to keep things organized and isolated.

The **Namespace** dropdown in the sidebar lets you:
- Select a specific namespace to see only resources that belong to it
- Choose **All Namespaces** to see everything you have access to

When you create a new Capp, ConfigMap, or Secret, it is placed in whichever namespace you currently have selected. If you have **All Namespaces** selected, new resources go into the **default** namespace.

---

## Why Capps Have Status Conditions

After you create or update a Capp, the **Capp Operator** continuously checks on it. The results of these checks appear as **Status Conditions** on the Capp detail page.

Each condition has:
- A **type** - what is being checked (e.g. "Ready", "Built", "Deployed")
- A **status** - the result: **True** (passing), **False** (failing), or **Unknown** (still checking)
- A **reason** - a short explanation of the current status
- A **last transition** — when the status last changed

**What to look for:**
- All conditions showing **True** - your app is healthy and running normally
- Any condition showing **False** - something needs attention. The reason field usually explains what went wrong.
- Conditions showing **Unknown** - the system is still evaluating. This is normal right after creating or updating a Capp.

If you see persistent **False** conditions, contact your platform team with the condition type and reason — they can investigate further.

---

## Where Does My Data Go?

Everything you create in RCS - Capps, ConfigMaps, and Secrets - is stored **in the Kubernetes cluster**, not in your browser or on a separate database.

This means:
- Your data persists even if you close your browser or sign out
- Other team members with access to the same cluster and namespace can see the same resources
- Deleting a resource in RCS removes it from the cluster permanently (that is why the app always asks for confirmation before deleting)

The RCS web app is just a convenient interface for viewing and managing what lives in the cluster.
