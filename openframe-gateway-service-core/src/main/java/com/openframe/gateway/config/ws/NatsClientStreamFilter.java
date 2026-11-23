package com.openframe.gateway.config.ws;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.io.ByteArrayOutputStream;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.function.Consumer;
import java.util.regex.Pattern;

import static java.nio.charset.StandardCharsets.UTF_8;
import static org.springframework.util.StringUtils.hasText;

/**
 * Vets the NATS protocol one client sends through the gateway against its {@link NatsSubjectPolicy}.
 * <p>
 * The websocket is a byte stream to NATS: a frame may carry several commands and a command may
 * continue in the next frame, so this is a stateful parser fed frame by frame. Complete control
 * lines are forwarded, an incomplete one is held back until its end arrives, and a {@code PUB}/
 * {@code HPUB} payload is copied through by length, never inspected.
 * <p>
 * A refused {@code SUB}/{@code PUB}/{@code HPUB} is removed from the stream (payload included) and
 * reported; the connection stays. The decorator then answers the client with the same
 * {@code -ERR Permissions Violation} NATS would send for a subject outside its permissions, so the
 * client's own handling of that error fires. Cutting the connection instead would turn a stale
 * subscription of an old client into a reconnect loop.
 * <p>
 * Only two things end the session, and only when enforcing: a {@code CONNECT} carrying a password,
 * token, JWT or nkey (the device user has an empty password, so any credential is a try to log in
 * as the service user from outside), and a control line NATS could not parse either. When not
 * enforcing, the parse trouble switches this filter off for the rest of the session instead, so the
 * observation phase can never cut a client the parser misreads.
 */
final class NatsClientStreamFilter {

    /** NATS's default {@code max_control_line}; the tenant configmap does not raise it. A longer line
     *  is refused by the server anyway, so cutting it here changes nothing for a real client. */
    static final int MAX_CONTROL_LINE_BYTES = 4096;
    static final String OPERATION_CONNECT = "CONNECT";
    static final String OPERATION_SUB = "SUB";
    static final String OPERATION_PUB = "PUB";
    static final String OPERATION_HPUB = "HPUB";
    static final String OPERATION_PROTOCOL = "PROTOCOL";

    private static final byte[] NOTHING = new byte[0];
    private static final Pattern WHITESPACE = Pattern.compile("[ \t]+");
    private static final Pattern PAYLOAD_SIZE = Pattern.compile("\\d{1,18}");
    private static final List<String> CREDENTIAL_FIELDS = List.of("pass", "auth_token", "jwt", "nkey", "sig");
    private static final byte LINE_END = '\n';
    private static final int PAYLOAD_TRAILER_BYTES = 2;
    private static final int SUBJECT_INDEX = 1;
    private static final int MIN_SUB_TOKENS = 3;
    private static final int MIN_PUB_TOKENS = 3;
    private static final int MIN_HPUB_TOKENS = 4;

    private final NatsSubjectPolicy policy;
    private final ObjectMapper objectMapper;
    private final Consumer<NatsViolation> violationListener;

    private final ByteArrayOutputStream pendingLine = new ByteArrayOutputStream();
    private long payloadRemaining;
    private boolean forwardPayload = true;
    private boolean bypass;

    NatsClientStreamFilter(NatsSubjectPolicy policy, ObjectMapper objectMapper, Consumer<NatsViolation> violationListener) {
        this.policy = policy;
        this.objectMapper = objectMapper;
        this.violationListener = violationListener;
    }

    /**
     * @return the bytes to forward to NATS for this frame: the frame itself when nothing was refused,
     * possibly empty while a control line is still incomplete or after a refused command.
     * @throws NatsStreamRejectedException when enforcing and the session has to end.
     */
    byte[] filter(byte[] frame, boolean enforce) {
        if (bypass) {
            return frame;
        }
        ByteArrayOutputStream out = new ByteArrayOutputStream(frame.length);
        int position = 0;
        while (position < frame.length) {
            if (bypass) {
                out.write(frame, position, frame.length - position);
                break;
            }
            if (isInsidePayload()) {
                position = consumePayload(frame, position, out);
            } else {
                position = consumeControlLine(frame, position, out, enforce);
            }
        }
        return out.toByteArray();
    }

    private boolean isInsidePayload() {
        return payloadRemaining > 0;
    }

    private int consumePayload(byte[] frame, int position, ByteArrayOutputStream out) {
        int available = frame.length - position;
        int count = (int) Math.min(payloadRemaining, available);
        if (forwardPayload) {
            out.write(frame, position, count);
        }
        payloadRemaining -= count;
        return position + count;
    }

    private int consumeControlLine(byte[] frame, int position, ByteArrayOutputStream out, boolean enforce) {
        int lineEnd = indexOfLineEnd(frame, position);
        if (lineEnd < 0) {
            pendingLine.write(frame, position, frame.length - position);
            guardControlLineLength(out, enforce);
            return frame.length;
        }
        pendingLine.write(frame, position, lineEnd - position + 1);
        byte[] line = takePendingLine();
        byte[] vetted = vetLine(line, enforce);
        out.writeBytes(vetted);
        return lineEnd + 1;
    }

    private void guardControlLineLength(ByteArrayOutputStream out, boolean enforce) {
        if (pendingLine.size() <= MAX_CONTROL_LINE_BYTES) {
            return;
        }
        byte[] held = takePendingLine();
        byte[] forwarded = protocolTrouble(held, "control line longer than " + MAX_CONTROL_LINE_BYTES + " bytes", enforce);
        out.writeBytes(forwarded);
    }

    private byte[] takePendingLine() {
        byte[] line = pendingLine.toByteArray();
        pendingLine.reset();
        return line;
    }

    private byte[] vetLine(byte[] line, boolean enforce) {
        String text = new String(line, UTF_8);
        String content = stripLineEnd(text);
        List<String> tokens = tokensOf(content);
        if (tokens.isEmpty()) {
            return line;
        }
        String operation = tokens.get(0).toUpperCase(Locale.ROOT);
        return switch (operation) {
            case OPERATION_SUB -> vetSubscribe(line, tokens, enforce);
            case OPERATION_PUB -> vetPublish(line, tokens, OPERATION_PUB, MIN_PUB_TOKENS, enforce);
            case OPERATION_HPUB -> vetPublish(line, tokens, OPERATION_HPUB, MIN_HPUB_TOKENS, enforce);
            case OPERATION_CONNECT -> vetConnect(line, tokens, content, enforce);
            default -> line;
        };
    }

    private byte[] vetSubscribe(byte[] line, List<String> tokens, boolean enforce) {
        if (tokens.size() < MIN_SUB_TOKENS) {
            return protocolTrouble(line, OPERATION_SUB + " with too few arguments", enforce);
        }
        String subject = tokens.get(SUBJECT_INDEX);
        if (policy.allowsSubscribe(subject)) {
            return line;
        }
        return refuse(line, OPERATION_SUB, subject, enforce);
    }

    private byte[] vetPublish(byte[] line, List<String> tokens, String operation, int minTokens, boolean enforce) {
        if (tokens.size() < minTokens) {
            return protocolTrouble(line, operation + " with too few arguments", enforce);
        }
        String size = tokens.get(tokens.size() - 1);
        if (!isPayloadSize(size)) {
            return protocolTrouble(line, operation + " payload size is not a number", enforce);
        }
        payloadRemaining = Long.parseLong(size) + PAYLOAD_TRAILER_BYTES;
        String subject = tokens.get(SUBJECT_INDEX);
        if (policy.allowsPublish(subject)) {
            forwardPayload = true;
            return line;
        }
        byte[] forwarded = refuse(line, operation, subject, enforce);
        forwardPayload = forwarded.length > 0;
        return forwarded;
    }

    private byte[] refuse(byte[] line, String operation, String subject, boolean enforce) {
        violationListener.accept(new NatsViolation(operation, subject));
        if (!enforce) {
            return line;
        }
        return NOTHING;
    }

    private byte[] vetConnect(byte[] line, List<String> tokens, String content, boolean enforce) {
        String verb = tokens.get(0);
        String json = content.strip().substring(verb.length()).trim();
        JsonNode options;
        try {
            options = objectMapper.readTree(json);
        } catch (Exception e) {
            return protocolTrouble(line, OPERATION_CONNECT + " options are not JSON", enforce);
        }
        return credentialFieldIn(options)
                .map(field -> rejectConnect(line, field, enforce))
                .orElse(line);
    }

    private byte[] rejectConnect(byte[] line, String credentialField, boolean enforce) {
        violationListener.accept(new NatsViolation(OPERATION_CONNECT, credentialField));
        if (enforce) {
            throw new NatsStreamRejectedException(OPERATION_CONNECT + " carries " + credentialField);
        }
        return line;
    }

    private byte[] protocolTrouble(byte[] line, String reason, boolean enforce) {
        violationListener.accept(new NatsViolation(OPERATION_PROTOCOL, reason));
        if (enforce) {
            throw new NatsStreamRejectedException(reason);
        }
        bypass = true;
        return line;
    }

    private static Optional<String> credentialFieldIn(JsonNode options) {
        return CREDENTIAL_FIELDS.stream()
                .filter(field -> hasCredential(options, field))
                .findFirst();
    }

    private static boolean hasCredential(JsonNode options, String field) {
        JsonNode value = options.path(field);
        return value.isTextual() && hasText(value.asText());
    }

    private static boolean isPayloadSize(String token) {
        return PAYLOAD_SIZE.matcher(token).matches();
    }

    private static int indexOfLineEnd(byte[] frame, int from) {
        for (int i = from; i < frame.length; i++) {
            if (frame[i] == LINE_END) {
                return i;
            }
        }
        return -1;
    }

    private static String stripLineEnd(String text) {
        return text.replaceAll("\\r?\\n$", "");
    }

    private static List<String> tokensOf(String content) {
        String[] tokens = WHITESPACE.split(content.strip());
        return Arrays.stream(tokens)
                .filter(token -> !token.isEmpty())
                .toList();
    }
}
