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
 * ({@code config.filter_subject}, {@code config.filter_subjects}) or, for the filtered form of the
 * API subject, in the subject itself; NATS rejects a mismatch between the two, so either is good.
 */
@Component
@RequiredArgsConstructor
public class ConsumerCreateRequestParser {

    private static final String STREAM_FIELD = "stream_name";
    private static final String CONFIG_FIELD = "config";
    private static final String FILTER_SUBJECT_FIELD = "filter_subject";
    private static final String FILTER_SUBJECTS_FIELD = "filter_subjects";
    private static final String DELIVER_SUBJECT_FIELD = "deliver_subject";

    private final ObjectMapper objectMapper;

    /** @throws NatsProtocolException when the body is not a JSON object. */
    public ConsumerCreateRequest parse(JetStreamApiSubject apiSubject, byte[] body) {
        JsonNode request = requestOf(body);
        JsonNode config = request.path(CONFIG_FIELD);
        String stream = streamOf(request, apiSubject);
        List<String> filterSubjects = filterSubjectsOf(config, apiSubject);
        ConsumerCreateRequest.ConsumerCreateRequestBuilder consumerCreateRequest = ConsumerCreateRequest.builder()
                .stream(stream)
                .filterSubjects(filterSubjects);
        textOf(config, DELIVER_SUBJECT_FIELD).ifPresent(consumerCreateRequest::deliverSubject);
        return consumerCreateRequest.build();
    }

    private JsonNode requestOf(byte[] body) {
        try {
            return objectMapper.readTree(body);
        } catch (Exception e) {
            throw new NatsProtocolException("consumer create request is not JSON");
        }
    }

    private static String streamOf(JsonNode request, JetStreamApiSubject apiSubject) {
        return textOf(request, STREAM_FIELD).orElse(apiSubject.getStream());
    }

    private static List<String> filterSubjectsOf(JsonNode config, JetStreamApiSubject apiSubject) {
        List<String> filters = new ArrayList<>();
        textOf(config, FILTER_SUBJECT_FIELD).ifPresent(filters::add);
        for (JsonNode filter : config.path(FILTER_SUBJECTS_FIELD)) {
            addText(filters, filter);
        }
        if (filters.isEmpty()) {
            apiSubject.getFilterSubject().ifPresent(filters::add);
        }
        return List.copyOf(filters);
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
