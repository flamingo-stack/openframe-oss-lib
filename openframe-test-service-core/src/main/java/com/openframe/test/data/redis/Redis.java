package com.openframe.test.data.redis;

import com.google.auth.oauth2.GoogleCredentials;
import com.openframe.test.config.RedisConfig;
import lombok.extern.slf4j.Slf4j;
import redis.clients.jedis.DefaultJedisClientConfig;
import redis.clients.jedis.DefaultRedisCredentials;
import redis.clients.jedis.JedisClientConfig;
import redis.clients.jedis.JedisCluster;
import redis.clients.jedis.RedisCredentials;
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

@Slf4j
public class Redis {

    /**
     * Find the password-reset token for {@code email}. The auth-server stores it under the tenant-scoped,
     * hash-tagged key {@code of:{<tenant>}:pwdreset:<token>} with the email as the value.
     *
     * <p>The hash tag is what makes this work on a cluster: Jedis routes a cluster SCAN by the slot of
     * the MATCH pattern and rejects a pattern without a tag, and every pwdreset key lands in that one
     * slot. Probing seed nodes one by one, as this did before, stops finding anything once the cluster
     * is reached through a single discovery endpoint instead of per-pod addresses.
     *
     * <p>Every failure - key absent, cluster unreachable, wrong tenant prefix - returns {@code null}.
     * Callers poll this method, so a failure has to look like a miss; the cause is logged with its stack
     * so a TLS or routing mistake is still diagnosable.
     */
    public static String getResetToken(String email) {
        String pattern = "of:{" + RedisConfig.getTenant() + "}:pwdreset:*";
        try (JedisCluster cluster = new JedisCluster(RedisConfig.getClusterNodes(), clientConfig())) {
            ScanParams scanParams = new ScanParams().match(pattern).count(100);
            String cursor = ScanParams.SCAN_POINTER_START;
            do {
                ScanResult<String> scanResult = cluster.scan(cursor, scanParams);
                List<String> keys = scanResult.getResult();
                if (!keys.isEmpty()) {
                    // One slot for the whole batch, so this is a single round trip rather than a GET per key.
                    List<String> emails = cluster.mget(keys.toArray(new String[0]));
                    for (int i = 0; i < keys.size(); i++) {
                        if (email.equals(emails.get(i))) {
                            return keys.get(i).split(":pwdreset:")[1];
                        }
                    }
                }
                cursor = scanResult.getCursor();
            } while (!cursor.equals(ScanParams.SCAN_POINTER_START));
        } catch (Exception e) {
            log.warn("Reading the password-reset token from Redis failed", e);
        }
        return null;
    }

    /**
     * Auth and TLS are independent and both optional: a token is sent only where the cluster runs
     * with IAM auth, TLS only where a CA is published. A plain in-cluster Redis has neither.
     *
     * <p>The client is built per call rather than cached: a caller polls at most a few dozen times, and
     * a cached static client would trade those handshakes for a topology-staleness problem.
     */
    private static JedisClientConfig clientConfig() throws GeneralSecurityException, IOException {
        DefaultJedisClientConfig.Builder builder = DefaultJedisClientConfig.builder();

        if (RedisConfig.isIamAuth()) {
            builder.credentialsProvider(Redis::iamCredentials);
        }

        String ca = RedisConfig.getCaCertificate();
        if (ca != null) {
            builder.ssl(true).sslSocketFactory(sslSocketFactory(ca));
        }

        return builder.build();
    }

    /**
     * A managed Redis on IAM takes an access token where a password would go. The supplier is called
     * per connection on purpose: the token expires within the hour and Google's own guidance is not
     * to cache one, so refreshing here keeps a long-polling caller from authenticating with a stale
     * credential. In a pod the identity comes from Workload Identity, so no key material is involved.
     */
    private static RedisCredentials iamCredentials() {
        try {
            GoogleCredentials credentials = GoogleCredentials.getApplicationDefault()
                    .createScoped("https://www.googleapis.com/auth/cloud-platform");
            credentials.refreshIfExpired();
            return new DefaultRedisCredentials(null, credentials.getAccessToken().getTokenValue());
        } catch (IOException e) {
            throw new IllegalStateException("Could not obtain an access token for Redis IAM auth", e);
        }
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
