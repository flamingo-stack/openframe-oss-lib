package com.openframe.authz.service.sso;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.openframe.data.redis.OpenframeRedisKeyBuilder;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;

import java.security.SecureRandom;
import java.time.Duration;
import java.util.Base64;
import java.util.Optional;

// Opaque handle for a mobile SSO signup; the pending identity is parked server-side (Redis) so the app only ever carries the ticket id.
@Slf4j
@Service
@RequiredArgsConstructor
public class SignupTicketService {

    private static final Duration TTL = Duration.ofMinutes(10);
    private static final String KEY_PREFIX = "sso:signup-ticket:";
    private static final SecureRandom RANDOM = new SecureRandom();

    private final RedisTemplate<String, String> redisTemplate;
    private final OpenframeRedisKeyBuilder keyBuilder;
    private final ObjectMapper objectMapper;

    public record SignupTicketPayload(String email,
                                      String firstName,
                                      String lastName,
                                      String provider,
                                      boolean emailVerified,
                                      String subject,
                                      String userId,
                                      String tenantId) {

        public boolean bound() {
            return userId != null && tenantId != null;
        }
    }

    public String create(String email, String firstName, String lastName, String provider,
                         boolean emailVerified, String subject) {
        byte[] raw = new byte[32];
        RANDOM.nextBytes(raw);
        String ticket = Base64.getUrlEncoder().withoutPadding().encodeToString(raw);
        write(ticket, new SignupTicketPayload(email, firstName, lastName, provider, emailVerified, subject, null, null), TTL);
        return ticket;
    }

    public Optional<SignupTicketPayload> peek(String ticket) {
        String json = redisTemplate.opsForValue().get(key(ticket));
        return decode(json);
    }

    // Keeps the remaining TTL when marking the ticket as belonging to a freshly registered user.
    public void bind(String ticket, String userId, String tenantId) {
        String k = key(ticket);
        Optional<SignupTicketPayload> current = decode(redisTemplate.opsForValue().get(k));
        if (current.isEmpty()) {
            throw new IllegalStateException("Signup session expired. Please sign in again.");
        }
        SignupTicketPayload p = current.get();
        Long remaining = redisTemplate.getExpire(k);
        Duration ttl = remaining != null && remaining > 0 ? Duration.ofSeconds(remaining) : TTL;
        write(ticket, new SignupTicketPayload(p.email(), p.firstName(), p.lastName(), p.provider(),
                p.emailVerified(), p.subject(), userId, tenantId), ttl);
    }

    // Atomic single use — the token mint, and only it, calls this.
    public Optional<SignupTicketPayload> consume(String ticket) {
        String json = redisTemplate.opsForValue().getAndDelete(key(ticket));
        return decode(json);
    }

    private void write(String ticket, SignupTicketPayload payload, Duration ttl) {
        try {
            redisTemplate.opsForValue().set(key(ticket), objectMapper.writeValueAsString(payload), ttl);
        } catch (Exception e) {
            throw new IllegalStateException("signup_ticket_write_failed", e);
        }
    }

    private Optional<SignupTicketPayload> decode(String json) {
        if (json == null) {
            return Optional.empty();
        }
        try {
            return Optional.of(objectMapper.readValue(json, SignupTicketPayload.class));
        } catch (Exception e) {
            log.warn("Undecodable signup ticket payload", e);
            return Optional.empty();
        }
    }

    private String key(String ticket) {
        return keyBuilder.tenantKey(KEY_PREFIX + ticket);
    }
}
