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
    private static volatile String password;
    private static volatile Boolean cluster;

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
     * AUTH string. Set where the server requires one (Memorystore creates every instance with auth
     * enabled); a plain in-cluster Redis leaves it unset and the client connects unauthenticated.
     */
    public static void setPassword(String authString) {
        password = authString;
    }

    public static String getPassword() {
        String value = (password != null && !password.trim().isEmpty())
                ? password
                : System.getenv("REDIS_PASSWORD");
        return (value != null && !value.trim().isEmpty()) ? value : null;
    }

    /**
     * Whether the server runs in cluster mode. True for the in-cluster shard set every environment
     * but dev still uses; dev points at a single Memorystore instance, where a cluster client fails
     * on topology discovery because cluster mode is disabled server-side.
     */
    public static void setCluster(boolean enabled) {
        cluster = enabled;
    }

    public static boolean isCluster() {
        if (cluster != null) {
            return cluster;
        }
        String env = System.getenv("REDIS_CLUSTER");
        return (env == null || env.trim().isEmpty()) || Boolean.parseBoolean(env);
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

    /** The single address a non-cluster server is reached on; the first entry when several are listed. */
    public static HostAndPort getNode() {
        return getClusterNodes().iterator().next();
    }

    public static String getTenant() {
        if (tenant != null && !tenant.trim().isEmpty()) {
            return tenant;
        }
        String env = System.getenv("REDIS_TENANT");
        return (env != null && !env.trim().isEmpty()) ? env : DEFAULT_TENANT;
    }
}
