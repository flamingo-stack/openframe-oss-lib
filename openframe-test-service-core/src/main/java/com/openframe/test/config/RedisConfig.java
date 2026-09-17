package com.openframe.test.config;

import redis.clients.jedis.HostAndPort;

import java.util.Arrays;
import java.util.LinkedHashSet;
import java.util.Set;

/**
 * Redis connection + key-namespace used by the test library (e.g. to read password-reset tokens).
 *
 * <p>Dev/stage/prod Redis is a cluster (see every service's {@code spring.data.redis.cluster.nodes}),
 * and the auth-server writes tenant-scoped keys {@code of:{<tenant>}:pwdreset:<token>} where
 * {@code <tenant>} = {@code openframe.redis.tenant-id} (resolves to {@code shared}). This holder lets the
 * host service inject both the cluster nodes and the tenant namespace from its config; standalone runs
 * fall back to {@code REDIS_NODES}/{@code REDIS_TENANT} env vars or in-cluster defaults.
 */
public class RedisConfig {

    private static final String DEFAULT_NODES =
            "redis-cluster-0.redis-cluster-headless.datasources.svc.cluster.local:6379,"
                    + "redis-cluster-1.redis-cluster-headless.datasources.svc.cluster.local:6379,"
                    + "redis-cluster-2.redis-cluster-headless.datasources.svc.cluster.local:6379";
    private static final String DEFAULT_TENANT = "shared";

    private static volatile String nodes;
    private static volatile String tenant;
    private static volatile String caCertificate;
    private static volatile Boolean iamAuth;

    public static void setNodes(String csvNodes) {
        nodes = csvNodes;
    }

    public static void setTenant(String tenantNamespace) {
        tenant = tenantNamespace;
    }

    /**
     * PEM of the CA that signed the server certificate. Present only where the cluster runs with
     * in-transit encryption (Memorystore); a plain in-cluster Redis leaves it unset and the client
     * connects without TLS.
     */
    public static void setCaCertificate(String pem) {
        caCertificate = pem;
    }

    public static String getCaCertificate() {
        String pem = (caCertificate != null && !caCertificate.trim().isEmpty())
                ? caCertificate
                : System.getenv("REDIS_SERVER_CA");
        return (pem != null && !pem.trim().isEmpty()) ? pem : null;
    }

    /**
     * Whether the cluster authenticates with IAM. Where it does, the client sends a short-lived
     * access token in place of a password and has to fetch a fresh one for every connection. A
     * cluster with auth disabled leaves this unset and the client connects unauthenticated.
     */
    public static void setIamAuth(boolean enabled) {
        iamAuth = enabled;
    }

    public static boolean isIamAuth() {
        if (iamAuth != null) {
            return iamAuth;
        }
        return Boolean.parseBoolean(System.getenv("REDIS_IAM_AUTH"));
    }

    public static Set<HostAndPort> getClusterNodes() {
        String csv = (nodes != null && !nodes.trim().isEmpty()) ? nodes : System.getenv("REDIS_NODES");
        if (csv == null || csv.trim().isEmpty()) {
            csv = DEFAULT_NODES;
        }
        Set<HostAndPort> hosts = new LinkedHashSet<>();
        Arrays.stream(csv.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .forEach(s -> hosts.add(HostAndPort.from(s)));
        return hosts;
    }

    public static String getTenant() {
        if (tenant != null && !tenant.trim().isEmpty()) {
            return tenant;
        }
        String env = System.getenv("REDIS_TENANT");
        return (env != null && !env.trim().isEmpty()) ? env : DEFAULT_TENANT;
    }
}
