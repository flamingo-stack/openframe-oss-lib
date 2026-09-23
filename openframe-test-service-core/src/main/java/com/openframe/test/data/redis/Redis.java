package com.openframe.test.data.redis;

import com.openframe.test.config.RedisConfig;
import lombok.extern.slf4j.Slf4j;
import redis.clients.jedis.DefaultJedisClientConfig;
import redis.clients.jedis.HostAndPort;
import redis.clients.jedis.Jedis;
import redis.clients.jedis.JedisClientConfig;
import redis.clients.jedis.JedisPooled;
import redis.clients.jedis.UnifiedJedis;
import redis.clients.jedis.params.ScanParams;
import redis.clients.jedis.resps.ScanResult;

import javax.net.ssl.SSLContext;
import javax.net.ssl.SSLSocketFactory;
import javax.net.ssl.TrustManagerFactory;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.KeyStore;
import java.security.cert.Certificate;
import java.security.cert.CertificateFactory;
import java.util.Collection;
import java.util.List;
import java.util.Set;

@Slf4j
public class Redis {

    /** What the server answered to CLUSTER INFO, remembered for the JVM. Null until first asked. */
    private static volatile Boolean detectedCluster;


    /**
     * Find the password-reset token for {@code email}. The auth-server stores it under the tenant-scoped,
     * hash-tagged key {@code of:{<tenant>}:pwdreset:<token>} with the email as the value.
     *
     * <p>The same scan works either way. On a cluster the hash tag is load-bearing: Jedis routes a
     * cluster SCAN by the slot of the MATCH pattern and rejects a pattern without a tag, and every
     * pwdreset key lands in that one slot. On a single instance the tag is just part of the key name.
     *
     * <p>Every failure - key absent, server unreachable, wrong tenant prefix - returns {@code null}.
     * Callers poll this method, so a failure has to look like a miss; the cause is logged with its stack
     * so a TLS or routing mistake is still diagnosable.
     */
    public static String getResetToken(String email) {
        String pattern = "of:{" + RedisConfig.getTenant() + "}:pwdreset:*";
        try {
            JedisClientConfig config = clientConfig();
            if (clusterMode(config)) {
                // SCAN is per-node: a cluster only ever reports the keys of the node answering it, so the
                // seeds are walked one by one. This deliberately does not use JedisCluster — that needs
                // CLUSTER SLOTS to succeed first, and the advertised addresses are not reachable from the
                // test pod, which is how this lookup broke on qa (JedisClusterOperationException: could
                // not initialize cluster slots cache) and took the password-reset case with it.
                Set<HostAndPort> seeds = RedisConfig.getClusterNodes();
                int scanned = 0;
                for (HostAndPort node : seeds) {
                    try (UnifiedJedis client = new JedisPooled(node, config)) {
                        String token = findToken(client, pattern, email);
                        scanned++;
                        if (token != null) {
                            return token;
                        }
                    } catch (Exception e) {
                        // Node unreachable or holding none of the slots — try the next seed.
                        log.debug("Seed {} did not answer the password-reset scan: {}", node, e.toString());
                    }
                }
                if (scanned == 0) {
                    // "Scanned every node and the token is not there yet" and "could not scan anything" are
                    // the same null to the caller, and the caller polls on it until a timeout. Only one of
                    // those is worth waking someone for: a reset that never lands leaves the tenant-report
                    // account half-rotated, which a re-run cannot repair.
                    log.warn("None of the {} Redis seeds could be scanned for the password-reset token; "
                            + "the token may exist and be unreachable rather than absent", seeds.size());
                }
                return null;
            }
            try (UnifiedJedis client = new JedisPooled(RedisConfig.getNode(), config)) {
                return findToken(client, pattern, email);
            }
        } catch (Exception e) {
            log.warn("Reading the password-reset token from Redis failed", e);
            return null;
        }
    }

    /** Walks one server's keyspace for the tenant's reset keys and returns the token whose value is the email. */
    private static String findToken(UnifiedJedis client, String pattern, String email) {
        ScanParams scanParams = new ScanParams().match(pattern).count(100);
        String cursor = ScanParams.SCAN_POINTER_START;
        do {
            ScanResult<String> scanResult = client.scan(cursor, scanParams);
            List<String> keys = scanResult.getResult();
            if (!keys.isEmpty()) {
                // The keys share the tenant hash tag, so one slot for the whole batch: a single round
                // trip rather than a GET per key.
                List<String> emails = client.mget(keys.toArray(new String[0]));
                for (int i = 0; i < keys.size(); i++) {
                    if (email.equals(emails.get(i))) {
                        return keys.get(i).split(":pwdreset:")[1];
                    }
                }
            }
            cursor = scanResult.getCursor();
        } while (!cursor.equals(ScanParams.SCAN_POINTER_START));
        return null;
    }

    /**
     * Whether the server runs in cluster mode, asked once and remembered.
     *
     * <p>SaaS Redis is moving to Memorystore for Valkey — one node, cluster mode disabled, TLS and AUTH —
     * one environment at a time, so this differs per environment and changes as the migration proceeds.
     * {@code CLUSTER INFO} is answered by both topologies, so one round trip settles it and an
     * environment migrates without anyone editing config. {@link RedisConfig#getConfiguredCluster()}
     * still wins where someone pinned an answer.
     *
     * <p>A probe that cannot connect assumes a cluster for that one lookup - that is what every
     * environment but dev is today, so it keeps the behaviour unchanged where the probe itself is the
     * thing that is broken. Only an answer the server actually gave is remembered: this pod lives for
     * days, and a probe lost to one dropped SYN must not pin a guess for all of them.
     */
    private static boolean clusterMode(JedisClientConfig config) {
        Boolean pinned = RedisConfig.getConfiguredCluster();
        if (pinned != null) {
            return pinned;
        }
        Boolean known = detectedCluster;
        if (known != null) {
            return known;
        }
        synchronized (Redis.class) {
            Boolean answered = detectedCluster;
            if (answered != null) {
                return answered;
            }
            Boolean probed = probeCluster(config);
            if (probed == null) {
                return true;
            }
            detectedCluster = probed;
            return probed;
        }
    }

    /** What the server says about itself, or {@code null} when it did not answer. */
    private static Boolean probeCluster(JedisClientConfig config) {
        HostAndPort node = RedisConfig.getNode();
        try (Jedis jedis = new Jedis(node, config)) {
            boolean enabled = jedis.clusterInfo().contains("cluster_enabled:1");
            log.info("Redis at {} reports cluster mode {}", node, enabled ? "enabled" : "disabled");
            return enabled;
        } catch (Exception e) {
            log.warn("Could not read CLUSTER INFO from {}; assuming a cluster for this lookup", node, e);
            return null;
        }
    }

    /**
     * Auth and TLS are independent and both optional: a password is sent only where the server requires
     * one, TLS only where a CA is published. A plain in-cluster Redis has neither.
     */
    private static JedisClientConfig clientConfig() throws GeneralSecurityException, IOException {
        DefaultJedisClientConfig.Builder builder = DefaultJedisClientConfig.builder();

        String password = RedisConfig.getPassword();
        if (password != null) {
            builder.password(password);
        }

        String ca = RedisConfig.getCaCertificate();
        if (ca != null) {
            builder.ssl(true).sslSocketFactory(sslSocketFactory(ca));
        }

        return builder.build();
    }

    /** Trust exactly the published CA - a managed Redis signs with a private one the JVM has never seen. */
    private static SSLSocketFactory sslSocketFactory(String caPem) throws GeneralSecurityException, IOException {
        Collection<? extends Certificate> certificates;
        try (ByteArrayInputStream in = new ByteArrayInputStream(caPem.getBytes(StandardCharsets.UTF_8))) {
            certificates = CertificateFactory.getInstance("X.509").generateCertificates(in);
        }
        if (certificates.isEmpty()) {
            // An empty trust store fails later as an unhelpful handshake error; say what is actually wrong.
            throw new IllegalStateException("The published Redis CA holds no certificate; expected PEM");
        }

        KeyStore trustStore = KeyStore.getInstance(KeyStore.getDefaultType());
        trustStore.load(null, null);
        int index = 0;
        for (Certificate certificate : certificates) {
            trustStore.setCertificateEntry("redis-ca-" + index++, certificate);
        }

        TrustManagerFactory trustManagers = TrustManagerFactory.getInstance(TrustManagerFactory.getDefaultAlgorithm());
        trustManagers.init(trustStore);

        SSLContext context = SSLContext.getInstance("TLS");
        context.init(null, trustManagers.getTrustManagers(), null);
        return context.getSocketFactory();
    }
}
