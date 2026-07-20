package com.openframe.test.data.redis;

import com.openframe.test.config.RedisConfig;
import redis.clients.jedis.HostAndPort;
import redis.clients.jedis.Jedis;
import redis.clients.jedis.params.ScanParams;
import redis.clients.jedis.resps.ScanResult;

public class Redis {

    /**
     * Find the password-reset token for {@code email}. The auth-server stores it under the tenant-scoped,
     * hash-tagged key {@code of:{<tenant>}:pwdreset:<token>} with the email as the value.
     *
     * <p>Connects standalone to each cluster seed node and does a node-local SCAN (rather than a
     * cluster client, whose topology discovery isn't reachable over the dev tunnel). The hash tag pins
     * every pwdreset key to a single node, so exactly one seed returns matches, and a GET on that same
     * node — which owns the slot — resolves the value.
     */
    public static String getResetToken(String email) {
        String pattern = "of:{" + RedisConfig.getTenant() + "}:pwdreset:*";
        for (HostAndPort node : RedisConfig.getClusterNodes()) {
            try (Jedis jedis = new Jedis(node)) {
                ScanParams scanParams = new ScanParams().match(pattern).count(100);
                String cursor = ScanParams.SCAN_POINTER_START;
                do {
                    ScanResult<String> scanResult = jedis.scan(cursor, scanParams);
                    for (String key : scanResult.getResult()) {
                        if (email.equals(jedis.get(key))) {
                            return key.split(":pwdreset:")[1];
                        }
                    }
                    cursor = scanResult.getCursor();
                } while (!cursor.equals(ScanParams.SCAN_POINTER_START));
            } catch (Exception e) {
                // Node unreachable or does not own the slot — try the next seed.
            }
        }
        return null;
    }
}
