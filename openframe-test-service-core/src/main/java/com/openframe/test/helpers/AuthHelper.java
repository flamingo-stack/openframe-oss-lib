package com.openframe.test.helpers;

import com.openframe.test.api.AuthApi;
import com.openframe.test.api.auth.AuthFlow;
import com.openframe.test.config.EnvironmentConfig;
import com.openframe.test.config.UserConfig;
import lombok.extern.slf4j.Slf4j;

import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.Map;
import java.util.Objects;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * The session every test runs as.
 *
 * <p><b>One login per run, not one per class.</b> Logging in is a six-step flow
 * ({@code discoverTenant → startFlow → initAuth → postCredentials → getAuthCode → extractTokens}), and
 * the cookies used to live in a {@code ThreadLocal} that {@link com.openframe.test.tests.BaseTest}
 * cleared in its {@code @BeforeAll} — so every class on every worker paid all six steps again. On the qa
 * dev suite that was 12 logins and 90 seconds of a 465-second run, on a network where a single dropped
 * SYN costs a 10-second connect timeout. The session is now established once and shared.
 *
 * <p><b>Keyed by identity, so it invalidates itself.</b> The cached session records the email, password,
 * tenant domain and base url it was obtained with. A pipeline registers a fresh tenant mid-run
 * ({@code OwnerRegistrationTest} randomises both), and the next call sees a different key and
 * authenticates again. Nothing has to remember to invalidate it, and a session can never leak across
 * tenants.
 *
 * <p><b>A case that needs its own identity installs an override.</b> {@link #setCookies} affects only the
 * calling thread, so {@code AuthTokensTest} rotating tokens or {@code OwnerRegistrationTest} logging in as
 * a freshly registered owner cannot rotate the session out from under three other workers.
 * {@link #clearCookies} drops that override and falls back to the shared session — which is what
 * {@code BaseTest} now does per class, at no cost.
 *
 * <p><b>Expiry is read from the token, not guessed.</b> The access token is a JWT and its lifetime is
 * configured per registered client, so the holder decodes {@code exp} and renews shortly before it
 * lapses; if the token is ever not a JWT it falls back to a conservative maximum age. Renewal uses the
 * refresh token and falls back to a full login when that is refused — which is what happens if something
 * revoked the session, such as a logout case running against the same account.
 */
@Slf4j
public class AuthHelper {

    /** Renew this long before the access token's own expiry, so a request never races it. */
    private static final Duration EXPIRY_MARGIN = Duration.ofSeconds(60);

    /** Used only when the access token carries no readable {@code exp}. */
    private static final Duration FALLBACK_MAX_AGE = Duration.ofMinutes(10);

    private static final Pattern EXP_CLAIM = Pattern.compile("\"exp\"\\s*:\\s*(\\d+)");

    private static final Object LOCK = new Object();

    /**
     * Held as one immutable value rather than three fields: the fast path reads it once, so it can never
     * see a session paired with someone else's key.
     */
    private static volatile Session session;

    private static final ThreadLocal<Map<String, String>> override = new ThreadLocal<>();

    public static Map<String, String> getCookies() {
        Map<String, String> own = override.get();
        return own != null ? own : sharedSession();
    }

    /**
     * Installs a session for the calling thread only, leaving the shared one alone. For a case that acts
     * as somebody else — a freshly registered owner, or a deliberately rotated token.
     */
    public static void setCookies(Map<String, String> newCookies) {
        override.set(newCookies);
    }

    /** Drops this thread's override, so it goes back to the shared session. No login is triggered. */
    public static void clearCookies() {
        override.remove();
    }

    /** Renews whichever session this thread is using. */
    public static Map<String, String> refresh() {
        Map<String, String> own = override.get();
        if (own != null) {
            Map<String, String> refreshed = AuthApi.refresh(own);
            override.set(refreshed);
            return refreshed;
        }
        synchronized (LOCK) {
            SessionKey key = SessionKey.current();
            Session current = session;
            Map<String, String> cookies = current == null || !current.key.equals(key)
                    ? login(key)
                    : renew(current.cookies, key);
            session = new Session(key, cookies, Instant.now());
            return cookies;
        }
    }

    private static Map<String, String> sharedSession() {
        SessionKey key = SessionKey.current();
        Session current = session;
        if (current != null && current.key.equals(key) && !expiring(current)) {
            return current.cookies;
        }
        synchronized (LOCK) {
            current = session;
            if (current == null || !current.key.equals(key)) {
                session = new Session(key, login(key), Instant.now());
            } else if (expiring(current)) {
                session = new Session(key, renew(current.cookies, key), Instant.now());
            }
            return session.cookies;
        }
    }

    private static Map<String, String> login(SessionKey key) {
        log.info("Authenticating as {} on {}", key.email, key.domain);
        return AuthFlow.login(UserConfig.getUser());
    }

    private static Map<String, String> renew(Map<String, String> cookies, SessionKey key) {
        try {
            log.info("Renewing the shared session for {}", key.email);
            return AuthApi.refresh(cookies);
        } catch (RuntimeException | AssertionError e) {
            // The refresh token can be gone rather than merely stale — a logout case run against this
            // account revokes it. A full login is the only way back, and it is still cheaper than the
            // per-class login this class replaced.
            log.warn("Refresh was refused ({}); authenticating again", e.toString());
            return login(key);
        }
    }

    private static boolean expiring(Session current) {
        Instant expiry = accessTokenExpiry(current.cookies);
        if (expiry != null) {
            return Instant.now().isAfter(expiry.minus(EXPIRY_MARGIN));
        }
        return Instant.now().isAfter(current.acquiredAt.plus(FALLBACK_MAX_AGE));
    }

    /**
     * Reads {@code exp} out of the access token. The signature is irrelevant here — the suite is not
     * validating the token, only deciding when to renew it — so the payload is decoded directly.
     */
    private static Instant accessTokenExpiry(Map<String, String> cookies) {
        String token = cookies.get("access_token");
        if (token == null || token.isBlank()) {
            return null;
        }
        String[] parts = token.split("\\.");
        if (parts.length < 2) {
            return null;
        }
        try {
            String padded = parts[1] + "=".repeat((4 - parts[1].length() % 4) % 4);
            String payload = new String(Base64.getUrlDecoder().decode(padded), StandardCharsets.UTF_8);
            Matcher claim = EXP_CLAIM.matcher(payload);
            return claim.find() ? Instant.ofEpochSecond(Long.parseLong(claim.group(1))) : null;
        } catch (RuntimeException e) {
            log.debug("Could not read exp from the access token ({}); falling back to max age", e.toString());
            return null;
        }
    }

    private record Session(SessionKey key, Map<String, String> cookies, Instant acquiredAt) {
    }

    /**
     * What a session belongs to. The password is held as a hash so the key can be compared and logged
     * about without carrying a credential around.
     */
    private record SessionKey(String email, String domain, String baseUrl, int passwordHash) {

        static SessionKey current() {
            return new SessionKey(
                    UserConfig.getEmail(),
                    EnvironmentConfig.getUserDomain(),
                    EnvironmentConfig.getBaseUrl(),
                    Objects.hashCode(UserConfig.getPassword()));
        }
    }
}
