package com.openframe.authz.service.auth;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.openframe.authz.dto.AuthErrorDetail;
import com.openframe.core.exception.AuthErrorCode;
import com.openframe.data.redis.OpenframeRedisKeyBuilder;
import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;

import java.security.SecureRandom;
import java.time.Duration;
import java.util.Optional;
import java.util.regex.Pattern;

import static java.util.stream.Collectors.joining;

// Holds the dynamic part of an auth failure (a provider reason, an email) so the redirect carries only a reference.
@Service
@RequiredArgsConstructor
public class AuthErrorDetailStore {

    private static final Duration TTL = Duration.ofMinutes(5);
    private static final String KEY_PREFIX = "auth:error:";
    // Support-friendly shape (7KQ2M9XD): no I, O, 0 or 1, so it reads and types without ambiguity.
    private static final String REFERENCE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    private static final int ALPHABET_SIZE = REFERENCE_ALPHABET.length();
    private static final int REFERENCE_LENGTH = 8;
    private static final Pattern REFERENCE_SHAPE = Pattern.compile("^[A-HJ-NP-Z2-9]{8}$");
    private static final SecureRandom RANDOM = new SecureRandom();

    private final RedisTemplate<String, String> redisTemplate;
    private final OpenframeRedisKeyBuilder keyBuilder;
    private final ObjectMapper objectMapper;

    public String save(AuthErrorCode code, String message) {
        String reference = newReference();
        String key = key(reference);
        String json = toJson(new AuthErrorDetail(code, message));
        redisTemplate.opsForValue().set(key, json, TTL);
        return reference;
    }

    public static boolean isReference(String value) {
        return value != null && REFERENCE_SHAPE.matcher(value).matches();
    }

    // Read, never consumed: the page may be refreshed; expiry is the TTL's job.
    public Optional<AuthErrorDetail> find(String reference) {
        String key = key(reference);
        String json = redisTemplate.opsForValue().get(key);
        return Optional.ofNullable(json).map(this::fromJson);
    }

    private static String newReference() {
        return RANDOM.ints(REFERENCE_LENGTH, 0, ALPHABET_SIZE)
                .mapToObj(REFERENCE_ALPHABET::charAt)
                .map(String::valueOf)
                .collect(joining());
    }

    private String key(String reference) {
        return keyBuilder.tenantKey(KEY_PREFIX + reference);
    }

    private String toJson(AuthErrorDetail detail) {
        try {
            return objectMapper.writeValueAsString(detail);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("auth_error_detail_write_failed", e);
        }
    }

    private AuthErrorDetail fromJson(String json) {
        try {
            return objectMapper.readValue(json, AuthErrorDetail.class);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("auth_error_detail_read_failed", e);
        }
    }
}
