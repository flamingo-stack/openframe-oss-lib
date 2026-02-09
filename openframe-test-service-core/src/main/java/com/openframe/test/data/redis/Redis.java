package com.openframe.test.data.redis;

import redis.clients.jedis.RedisClient;
import redis.clients.jedis.params.ScanParams;
import redis.clients.jedis.resps.ScanResult;

import static com.openframe.test.config.RedisConfig.getRedisUri;

public class Redis {

    private static final String KEY = "of:{default}:pwdreset:*";

    public static String getResetToken(String email) {
        RedisClient redis = RedisClient.create(getRedisUri());
        ScanParams scanParams = new ScanParams().match(KEY).count(100);
        String cursor = ScanParams.SCAN_POINTER_START;
        String token = null;
        do {
            ScanResult<String> scanResult = redis.scan(cursor, scanParams);
            for (String key : scanResult.getResult()) {
                if (email.equals(redis.get(key))) {
                    token = key.split(":pwdreset:")[1];
                    break;
                }
            }
            if (token != null) break;
            cursor = scanResult.getCursor();
        } while (!cursor.equals(ScanParams.SCAN_POINTER_START));
        redis.close();
        return token;
    }
}
