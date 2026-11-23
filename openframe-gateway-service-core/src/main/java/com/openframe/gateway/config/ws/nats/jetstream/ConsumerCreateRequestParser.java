package com.openframe.gateway.config.ws.nats.jetstream;

import com.openframe.gateway.config.ws.nats.protocol.NatsProtocolException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.springframework.util.StringUtils.hasText;

/**
 * Reads the JSON body of a consumer-create call. The filter may sit in the body
 * ({@code config.filter_subject} or {@code config.filter_subjects}) or, for the filtered form of
 * the API subject, in the subject itself. The gateway authorizes exactly the filter it forwards, so
 * a body that names the filter twice, or a subject filter the body contradicts, is marked ambiguous
 * instead of being read one way or the other.
 */
@Component
@RequiredArgsConstructor
public class ConsumerCreateRequestParser {

    static final String AMBIGUITY_BOTH_FILTER_FIELDS = "both filter_subject and filter_subjects set";
    static final String AMBIGUITY_SUBJECT_DIFFERS = "filter in the API subject differs from the body";
    static final String AMBIGUITY_STREAM_DIFFERS = "stream_name in the body differs from the API subject";

    private static final String STREAM_FIELD = "stream_name";
    private static final String CONFIG_FIELD = "config";
    private static final String FILTER_SUBJECT_FIELD = "filter_subject";
    private static final String FILTER_SUBJECTS_FIELD = "filter_subjects";
    private static final String DELIVER_SUBJECT_FIELD = "deliver_subject";
    private static final String DURABLE_NAME_FIELD = "durable_name";

    private final ObjectMapper objectMapper;

    /** @throws NatsProtocolException when the body is not a JSON object. */
    public ConsumerCreateRequest parse(JetStreamApiSubject apiSubject, byte[] body) {
        JsonNode request = requestOf(body);
        JsonNode config = request.path(CONFIG_FIELD);
        Optional<String> bodyStream = textOf(request, STREAM_FIELD);
        Optional<String> singleFilter = textOf(config, FILTER_SUBJECT_FIELD);
        List<String> listedFilters = listedFiltersOf(config);
        List<String> bodyFilters = bodyFiltersOf(singleFilter, listedFilters);
        List<String> filterSubjects = filterSubjectsOf(bodyFilters, apiSubject);
        ConsumerCreateRequest.ConsumerCreateRequestBuilder consumerCreateRequest = ConsumerCreateRequest.builder()
                .stream(apiSubject.getStream())
                .filterSubjects(filterSubjects);
        textOf(config, DELIVER_SUBJECT_FIELD).ifPresent(consumerCreateRequest::deliverSubject);
        ambiguityOf(bodyStream, singleFilter, listedFilters, bodyFilters, apiSubject).ifPresent(consumerCreateRequest::ambiguity);
        boolean durable = textOf(config, DURABLE_NAME_FIELD).isPresent();
        consumerCreateRequest.durable(durable);
        return consumerCreateRequest.build();
    }

    private JsonNode requestOf(byte[] body) {
        try {
            return objectMapper.readTree(body);
        } catch (Exception e) {
            throw new NatsProtocolException("consumer create request is not JSON");
        }
    }

    private static List<String> listedFiltersOf(JsonNode config) {
        List<String> filters = new ArrayList<>();
        for (JsonNode filter : config.path(FILTER_SUBJECTS_FIELD)) {
            addText(filters, filter);
        }
        return List.copyOf(filters);
    }

    private static List<String> bodyFiltersOf(Optional<String> singleFilter, List<String> listedFilters) {
        return singleFilter
                .map(List::of)
                .orElse(listedFilters);
    }

    /** The body's filter when it has one, else the filter the API subject carries, else none. */
    private static List<String> filterSubjectsOf(List<String> bodyFilters, JetStreamApiSubject apiSubject) {
        if (!bodyFilters.isEmpty()) {
            return bodyFilters;
        }
        return apiSubject.getFilterSubject()
                .map(List::of)
                .orElse(List.of());
    }

    /** NATS binds the call to the stream in the subject; a body that names another one is not read either way. */
    private static Optional<String> ambiguityOf(Optional<String> bodyStream, Optional<String> singleFilter,
                                                List<String> listedFilters, List<String> bodyFilters,
                                                JetStreamApiSubject apiSubject) {
        if (isStreamContradicted(bodyStream, apiSubject)) {
            return Optional.of(AMBIGUITY_STREAM_DIFFERS);
        }
        if (hasBothFilterFields(singleFilter, listedFilters)) {
            return Optional.of(AMBIGUITY_BOTH_FILTER_FIELDS);
        }
        if (isSubjectFilterContradicted(bodyFilters, apiSubject)) {
            return Optional.of(AMBIGUITY_SUBJECT_DIFFERS);
        }
        return Optional.empty();
    }

    private static boolean isStreamContradicted(Optional<String> bodyStream, JetStreamApiSubject apiSubject) {
        String subjectStream = apiSubject.getStream();
        return bodyStream
                .map(stream -> !stream.equals(subjectStream))
                .orElse(false);
    }

    private static boolean hasBothFilterFields(Optional<String> singleFilter, List<String> listedFilters) {
        return singleFilter.isPresent() && !listedFilters.isEmpty();
    }

    private static boolean isSubjectFilterContradicted(List<String> bodyFilters, JetStreamApiSubject apiSubject) {
        if (bodyFilters.isEmpty()) {
            return false;
        }
        return apiSubject.getFilterSubject()
                .map(List::of)
                .map(expected -> !expected.equals(bodyFilters))
                .orElse(false);
    }

    private static void addText(List<String> filters, JsonNode node) {
        if (node.isTextual() && hasText(node.asText())) {
            filters.add(node.asText());
        }
    }

    private static Optional<String> textOf(JsonNode node, String field) {
        JsonNode value = node.path(field);
        if (value.isTextual() && hasText(value.asText())) {
            return Optional.of(value.asText());
        }
        return Optional.empty();
    }
}
