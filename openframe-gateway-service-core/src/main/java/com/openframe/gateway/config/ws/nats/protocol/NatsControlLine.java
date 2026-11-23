package com.openframe.gateway.config.ws.nats.protocol;

import lombok.Builder;
import lombok.Value;

import java.util.List;
import java.util.Optional;

import static java.nio.charset.StandardCharsets.UTF_8;

/**
 * One parsed NATS control line. {@code raw} keeps the bytes as the client sent them, line end
 * included, so an allowed line is relayed byte for byte.
 */
@Value
@Builder
public class NatsControlLine {

    private static final int SUBJECT_INDEX = 1;
    private static final int REPLY_INDEX = 2;
    private static final int PUB_TOKENS_WITH_REPLY = 4;
    private static final int HPUB_TOKENS_WITH_REPLY = 5;
    private static final long NO_PAYLOAD = 0;

    NatsOperation operation;
    List<String> tokens;
    long payloadSize;
    byte[] raw;

    public Optional<String> getSubject() {
        if (!operation.carriesSubject()) {
            return Optional.empty();
        }
        return Optional.of(tokens.get(SUBJECT_INDEX));
    }

    /** The reply-to subject of a {@code PUB}/{@code HPUB} that carries one: where the responder will publish. */
    public Optional<String> getReplySubject() {
        if (!operation.isPublish() || !hasReplyToken()) {
            return Optional.empty();
        }
        return Optional.of(tokens.get(REPLY_INDEX));
    }

    private boolean hasReplyToken() {
        int tokensWithReply = operation == NatsOperation.HPUB ? HPUB_TOKENS_WITH_REPLY : PUB_TOKENS_WITH_REPLY;
        return tokens.size() == tokensWithReply;
    }

    public boolean hasPayload() {
        return payloadSize > NO_PAYLOAD;
    }

    public String getVerb() {
        return tokens.get(0);
    }

    /** Everything after the verb, which for {@code CONNECT} is its JSON options object. */
    public String getArguments() {
        String line = new String(raw, UTF_8).strip();
        return line.substring(getVerb().length()).strip();
    }
}
