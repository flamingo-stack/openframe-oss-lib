package com.openframe.gateway.config.ws.nats.protocol;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.util.List;
import java.util.Optional;

import static org.springframework.util.StringUtils.hasText;

/**
 * Reads the JSON options of a {@code CONNECT} line for the one thing the gateway cares about: a
 * credential. The device user has an empty password, so a client through the gateway never
 * needs one; a password, token, JWT or nkey is a try to log in as the service user from outside.
 */
@Component
@RequiredArgsConstructor
public class NatsConnectOptionsParser {

    private static final List<String> CREDENTIAL_FIELDS = List.of("pass", "auth_token", "jwt", "nkey", "sig");

    private final ObjectMapper objectMapper;

    /**
     * @return the first credential field that carries a value.
     * @throws NatsProtocolException when the options are not a JSON object.
     */
    public Optional<String> credentialFieldOf(NatsControlLine connect) {
        JsonNode options = optionsOf(connect);
        return CREDENTIAL_FIELDS.stream()
                .filter(field -> hasCredential(options, field))
                .findFirst();
    }

    private JsonNode optionsOf(NatsControlLine connect) {
        String json = connect.arguments();
        try {
            return objectMapper.readTree(json);
        } catch (Exception e) {
            throw new NatsProtocolException("CONNECT options are not JSON");
        }
    }

    private static boolean hasCredential(JsonNode options, String field) {
        JsonNode value = options.path(field);
        return value.isTextual() && hasText(value.asText());
    }
}
