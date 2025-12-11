package com.openframe.authz.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Base64;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class SsoCookieCodec {

    private static final Base64.Encoder B64 = Base64.getUrlEncoder().withoutPadding();
    private static final Base64.Decoder B64D = Base64.getUrlDecoder();
    private static final String ALG = "HmacSHA256";

    private final ObjectMapper objectMapper;

    @Value("${openframe.sso.registration-cookie.secret:change-me-in-config}")
    private String hmacSecret;

    public String encode(Object payload) {
        try {
            byte[] json = objectMapper.writeValueAsBytes(payload);
            String body = B64.encodeToString(json);
            String sig = sign(body);
            return body + "." + sig;
        } catch (Exception e) {
            throw new IllegalStateException("cookie_sign_failed", e);
        }
    }

    public String encodeTenant(SsoTenantRegCookiePayload payload) {
        return encode(payload);
    }

    public String encodeInvite(SsoInviteCookiePayload payload) {
        return encode(payload);
    }

    public Optional<SsoTenantRegCookiePayload> decodeTenant(String token) {
        return decode(token, SsoTenantRegCookiePayload.class);
    }

    public Optional<SsoInviteCookiePayload> decodeInvite(String token) {
        return decode(token, SsoInviteCookiePayload.class);
    }

    public <T> Optional<T> decode(String token, Class<T> type) {
        try {
            if (token == null) {
                return Optional.empty();
            }
            int dot = token.indexOf('.');
            if (dot <= 0 || dot >= token.length() - 1) {
                return Optional.empty();
            }
            String body = token.substring(0, dot);
            String sig = token.substring(dot + 1);
            String expected = sign(body);
            if (!constantTimeEquals(sig, expected)) {
                return Optional.empty();
            }
            byte[] json = B64D.decode(body);
            T payload = objectMapper.readValue(json, type);
            long exp = extractExp(payload);
            if (exp > 0 && exp < Instant.now().getEpochSecond()) {
                return Optional.empty();
            }
            return Optional.of(payload);
        } catch (Exception e) {
            return Optional.empty();
        }
    }

    private long extractExp(Object payload) {
        try {
            var m = payload.getClass().getMethod("exp");
            Object v = m.invoke(payload);
            return v instanceof Number n ? n.longValue() : 0L;
        } catch (Exception ignored) {
            return 0L;
        }
    }

    private String sign(String body) throws Exception {
        Mac mac = Mac.getInstance(ALG);
        mac.init(new SecretKeySpec(hmacSecret.getBytes(StandardCharsets.UTF_8), ALG));
        byte[] raw = mac.doFinal(body.getBytes(StandardCharsets.UTF_8));
        return B64.encodeToString(raw);
    }

    private static boolean constantTimeEquals(String a, String b) {
        if (a == null || b == null) return false;
        if (a.length() != b.length()) return false;
        int result = 0;
        for (int i = 0; i < a.length(); i++) {
            result |= a.charAt(i) ^ b.charAt(i);
        }
        return result == 0;
    }
}

