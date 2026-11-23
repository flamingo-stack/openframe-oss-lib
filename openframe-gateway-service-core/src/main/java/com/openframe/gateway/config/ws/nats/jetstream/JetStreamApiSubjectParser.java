package com.openframe.gateway.config.ws.nats.jetstream;

import org.springframework.stereotype.Component;

import java.util.Arrays;
import java.util.Optional;

/**
 * Recognises a consumer-create among the subjects a client publishes to and reads the stream,
 * consumer name and filter the API subject itself carries, so the validator knows which requests
 * need their body inspected and which stream rule to ask.
 */
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
        JetStreamApiSubject.JetStreamApiSubjectBuilder call = JetStreamApiSubject.builder().stream(tokens[STREAM_INDEX]);
        if (hasToken(tokens, CONSUMER_INDEX)) {
            call.consumerName(tokens[CONSUMER_INDEX]);
        }
        if (hasToken(tokens, FILTER_START_INDEX)) {
            call.filterSubject(filterFrom(tokens));
        }
        return call.build();
    }

    private static boolean hasToken(String[] tokens, int index) {
        return index < tokens.length;
    }

    /** The filter subject keeps its own dots, so it is everything after the consumer name. */
    private static String filterFrom(String[] tokens) {
        String[] filterTokens = Arrays.copyOfRange(tokens, FILTER_START_INDEX, tokens.length);
        return String.join(TOKEN_SEPARATOR, filterTokens);
    }
}
