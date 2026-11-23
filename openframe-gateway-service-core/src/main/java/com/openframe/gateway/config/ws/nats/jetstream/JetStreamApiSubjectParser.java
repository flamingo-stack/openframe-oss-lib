package com.openframe.gateway.config.ws.nats.jetstream;

import org.springframework.stereotype.Component;

import java.util.Arrays;
import java.util.List;
import java.util.Optional;

/**
 * Recognises the JetStream API calls a client publishes to: a consumer-create, whose stream,
 * consumer name and filter the API subject itself carries, and the calls on an existing consumer
 * ({@code INFO}, {@code DELETE}, {@code MSG.NEXT}), whose only handle is the consumer name.
 */
@Component
public class JetStreamApiSubjectParser {

    private static final String CONSUMER_CREATE_PREFIX = "$JS.API.CONSUMER.CREATE.";
    private static final String DURABLE_CREATE_PREFIX = "$JS.API.CONSUMER.DURABLE.CREATE.";
    private static final List<String> CONSUMER_ACCESS_PREFIXES = List.of(
            "$JS.API.CONSUMER.INFO.",
            "$JS.API.CONSUMER.DELETE.",
            "$JS.API.CONSUMER.MSG.NEXT."
    );
    private static final String TOKEN_SEPARATOR = ".";
    private static final int STREAM_INDEX = 0;
    private static final int CONSUMER_INDEX = 1;
    private static final int FILTER_START_INDEX = 2;
    private static final int ACCESS_TOKEN_COUNT = 2;

    /** @return the call when {@code subject} creates a consumer, empty for any other subject. */
    public Optional<JetStreamApiSubject> consumerCreateOf(String subject) {
        if (subject.startsWith(CONSUMER_CREATE_PREFIX)) {
            String remainder = subject.substring(CONSUMER_CREATE_PREFIX.length());
            return Optional.of(parseCreate(remainder));
        }
        if (subject.startsWith(DURABLE_CREATE_PREFIX)) {
            String remainder = subject.substring(DURABLE_CREATE_PREFIX.length());
            return Optional.of(parseCreate(remainder));
        }
        return Optional.empty();
    }

    /** @return the call when {@code subject} reads, deletes or pulls from an existing consumer. */
    public Optional<JetStreamConsumerAccess> consumerAccessOf(String subject) {
        return CONSUMER_ACCESS_PREFIXES.stream()
                .filter(subject::startsWith)
                .findFirst()
                .flatMap(prefix -> parseAccess(subject.substring(prefix.length())));
    }

    private static JetStreamApiSubject parseCreate(String remainder) {
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

    /** A consumer name is one token; anything else is not a call this gateway knows how to vet. */
    private static Optional<JetStreamConsumerAccess> parseAccess(String remainder) {
        String[] tokens = remainder.split("\\.", -1);
        if (tokens.length != ACCESS_TOKEN_COUNT) {
            return Optional.empty();
        }
        return Optional.of(new JetStreamConsumerAccess(tokens[STREAM_INDEX], tokens[CONSUMER_INDEX]));
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
