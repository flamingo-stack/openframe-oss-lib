package com.openframe.gateway.config.ws.nats.protocol;

import org.springframework.stereotype.Component;

import java.util.Arrays;
import java.util.List;
import java.util.regex.Pattern;

import static java.nio.charset.StandardCharsets.UTF_8;

/**
 * Parses one NATS control line into {@link NatsControlLine}: the verb (case-insensitive, as NATS
 * reads it), its whitespace-separated arguments, and for {@code PUB}/{@code HPUB} the number of
 * payload bytes that follow — the last argument, so a reply subject never shifts it.
 */
@Component
public class NatsControlLineParser {

    private static final Pattern WHITESPACE = Pattern.compile("[ \t]+");
    private static final Pattern PAYLOAD_SIZE = Pattern.compile("\\d{1,18}");
    private static final int MIN_SUB_TOKENS = 3;
    private static final int MIN_PUB_TOKENS = 3;
    private static final int MIN_HPUB_TOKENS = 4;
    private static final long NO_PAYLOAD = 0;

    /**
     * @throws NatsProtocolException on a line NATS would refuse as well: a {@code SUB}/{@code PUB}
     * with too few arguments or a payload size that is not a number.
     */
    public NatsControlLine parse(byte[] raw) {
        String line = new String(raw, UTF_8);
        List<String> tokens = tokensOf(line);
        if (tokens.isEmpty()) {
            return new NatsControlLine(NatsOperation.OTHER, tokens, NO_PAYLOAD, raw);
        }
        NatsOperation operation = NatsOperation.of(tokens.get(0));
        requireArguments(operation, tokens);
        long payloadSize = payloadSizeOf(operation, tokens);
        return new NatsControlLine(operation, tokens, payloadSize, raw);
    }

    private static void requireArguments(NatsOperation operation, List<String> tokens) {
        int minimum = switch (operation) {
            case SUB -> MIN_SUB_TOKENS;
            case PUB -> MIN_PUB_TOKENS;
            case HPUB -> MIN_HPUB_TOKENS;
            default -> 0;
        };
        if (tokens.size() < minimum) {
            throw new NatsProtocolException(operation + " with too few arguments");
        }
    }

    private static long payloadSizeOf(NatsOperation operation, List<String> tokens) {
        if (!operation.isPublish()) {
            return NO_PAYLOAD;
        }
        String size = tokens.get(tokens.size() - 1);
        if (!isPayloadSize(size)) {
            throw new NatsProtocolException(operation + " payload size is not a number");
        }
        return Long.parseLong(size);
    }

    private static boolean isPayloadSize(String token) {
        return PAYLOAD_SIZE.matcher(token).matches();
    }

    private static List<String> tokensOf(String line) {
        String[] tokens = WHITESPACE.split(line.strip());
        return Arrays.stream(tokens)
                .filter(token -> !token.isEmpty())
                .toList();
    }
}
