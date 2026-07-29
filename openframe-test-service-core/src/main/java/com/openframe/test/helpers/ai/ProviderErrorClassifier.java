package com.openframe.test.helpers.ai;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.openframe.test.data.dto.ai.MessageData;
import lombok.extern.slf4j.Slf4j;

import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Decides whether a terminal run failed because the <em>model provider</em> was unavailable — overloaded,
 * rate-limited, or 5xx — as opposed to the assistant doing the wrong thing.
 *
 * <p><b>Deliberately narrow.</b> This is the gate in front of a retry, so a false positive silently
 * re-runs a case that legitimately failed and can mask a real product bug. It therefore matches only on
 * the machine-readable {@code details} payload of an {@code ERROR} message — the provider's own error
 * {@code type}, or an HTTP status if one is carried — and never on the {@code error} prose field, which
 * reads {@code "AI response error"} for provider outages and tool failures alike. A tool-execution error
 * or a model refusal carries neither marker and is classified as behavioral, i.e. the test keeps failing.
 *
 * <p>Callers must classify a <em>single attempt's</em> conversation. {@link RunResult#errors()} is
 * conversation-wide with no per-entry timestamp, so re-sending a prompt on a dialog that already carries
 * a provider error would make this return {@code true} forever; drive retries on a fresh dialog.
 */
@Slf4j
public final class ProviderErrorClassifier {

    /** Provider error types that mean "the request never really ran, try again". */
    private static final Set<String> RETRYABLE_TYPES =
            Set.of("overloaded_error", "rate_limit_error", "api_error");

    /** HTTP statuses carrying the same meaning, for payloads that report a status instead of a type. */
    private static final Set<Integer> RETRYABLE_STATUSES = Set.of(503, 529);

    /**
     * Fallback for a {@code details} payload that is not parseable JSON. Still requires the JSON
     * key/value shape, so assistant prose that merely mentions being overloaded cannot match.
     */
    private static final Pattern TYPE_TOKEN = Pattern.compile(
            "\"type\"\\s*:\\s*\"(overloaded_error|rate_limit_error|api_error)\"");

    private static final Pattern REQUEST_ID_TOKEN = Pattern.compile(
            "\"request_id\"\\s*:\\s*\"([^\"]+)\"");

    private static final ObjectMapper MAPPER = new ObjectMapper();

    private ProviderErrorClassifier() {
    }

    /** True if any error in this attempt's conversation is a retryable provider failure. */
    public static boolean isRetryable(RunResult result) {
        if (result == null) {
            return false;
        }
        return result.errors().stream().anyMatch(ProviderErrorClassifier::isRetryable);
    }

    /** True if this single {@code ERROR} entry is a retryable provider failure. */
    static boolean isRetryable(MessageData error) {
        String details = error == null ? null : error.getDetails();
        if (details == null || details.isBlank()) {
            return false;
        }

        JsonNode root = parseQuietly(details);
        if (root == null) {
            return TYPE_TOKEN.matcher(details).find();
        }

        // The observed shape nests the real type: {"type":"error","error":{"type":"overloaded_error",...}}.
        // Fall back to a top-level type for payloads that are the inner object itself; the outer "error"
        // value is not in RETRYABLE_TYPES, so reading it cannot produce a false positive.
        String type = text(root.path("error").path("type"));
        if (type == null) {
            type = text(root.path("type"));
        }
        if (type != null && RETRYABLE_TYPES.contains(type)) {
            return true;
        }

        Integer status = status(root);
        return status != null && RETRYABLE_STATUSES.contains(status);
    }

    /**
     * The upstream {@code request_id} of the first error carrying one, for correlating with the provider's
     * own logs, or {@code null} if none is present.
     */
    public static String requestId(RunResult result) {
        if (result == null) {
            return null;
        }
        for (MessageData error : result.errors()) {
            String details = error.getDetails();
            if (details == null || details.isBlank()) {
                continue;
            }
            JsonNode root = parseQuietly(details);
            String id = root == null ? null : text(root.path("request_id"));
            if (id != null) {
                return id;
            }
            Matcher m = REQUEST_ID_TOKEN.matcher(details);
            if (m.find()) {
                return m.group(1);
            }
        }
        return null;
    }

    private static Integer status(JsonNode root) {
        for (String field : new String[]{"status", "http_status", "statusCode"}) {
            JsonNode node = root.path(field);
            if (node.isInt()) {
                return node.intValue();
            }
        }
        return null;
    }

    private static JsonNode parseQuietly(String json) {
        try {
            return MAPPER.readTree(json);
        } catch (Exception e) {
            log.debug("Error details are not parseable JSON, falling back to token match: {}", e.getMessage());
            return null;
        }
    }

    private static String text(JsonNode node) {
        return node != null && node.isTextual() ? node.asText() : null;
    }
}
