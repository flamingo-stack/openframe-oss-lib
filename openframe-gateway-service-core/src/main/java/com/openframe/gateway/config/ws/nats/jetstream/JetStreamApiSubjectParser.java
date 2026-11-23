package com.openframe.gateway.config.ws.nats.jetstream;

import org.springframework.stereotype.Component;

import java.util.Optional;

@Component
public class JetStreamApiSubjectParser {

    private static final String CONSUMER_CREATE_PREFIX = "$JS.API.CONSUMER.CREATE.";
    private static final String DURABLE_CREATE_PREFIX = "$JS.API.CONSUMER.DURABLE.CREATE.";
    private static final String TOKEN_SEPARATOR = ".";
    private static final int STREAM_INDEX = 0;
    private static final int CONSUMER_INDEX = 1;
    private static final int FILTER_START_INDEX = 2;

    /** @return the call when {@code subject} creates a consumer, empty for any other subject. */
    public Optional<JetStreamApiSubject> consumerCreateOf(String subject) {
        if (subject.startsWith(CONSUMER_CREATE_PREFIX)) {
            String remainder = subject.substring(CONSUMER_CREATE_PREFIX.length());
            return Optional.of(parse(remainder));
        }
        if (subject.startsWith(DURABLE_CREATE_PREFIX)) {
            String remainder = subject.substring(DURABLE_CREATE_PREFIX.length());
            return Optional.of(parse(remainder));
        }
        return Optional.empty();
    }

    private static JetStreamApiSubject parse(String remainder) {
        String[] tokens = remainder.split("\\.", -1);
        String stream = tokens[STREAM_INDEX];
        Optional<String> consumerName = tokenAt(tokens, CONSUMER_INDEX);
        Optional<String> filterSubject = filterFrom(tokens);
        return new JetStreamApiSubject(stream, consumerName, filterSubject);
    }

    private static Optional<String> tokenAt(String[] tokens, int index) {
        if (index >= tokens.length) {
            return Optional.empty();
        }
        return Optional.of(tokens[index]);
    }

    /** The filter subject keeps its own dots, so it is everything after the consumer name. */
    private static Optional<String> filterFrom(String[] tokens) {
        if (tokens.length <= FILTER_START_INDEX) {
            return Optional.empty();
        }
        String filter = String.join(TOKEN_SEPARATOR, java.util.Arrays.copyOfRange(tokens, FILTER_START_INDEX, tokens.length));
        return Optional.of(filter);
    }
}
