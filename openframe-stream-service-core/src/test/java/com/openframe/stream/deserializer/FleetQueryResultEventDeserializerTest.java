package com.openframe.stream.deserializer;

import com.openframe.stream.service.FleetMdmCacheService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import static org.assertj.core.api.Assertions.assertThat;

@ExtendWith(MockitoExtension.class)
class FleetQueryResultEventDeserializerTest {

    private final JsonMapper mapper = new JsonMapper();

    @Mock
    private FleetMdmCacheService fleetMdmCacheService;

    @Test
    void shouldTreatDataAndErrorOfAnUnexpectedTypeAsAbsent() {
        // Jackson 3 asString() throws on an object where Jackson 2 returned ""
        JsonNode after = mapper.readTree("{\"host_id\":7,\"data\":{\"rows\":[]},\"error\":[\"x\"]}");
        FleetQueryResultEventDeserializer deserializer = deserializer();

        assertThat(deserializer.getResult(after)).isNull();
        assertThat(deserializer.getError(after)).isNull();
    }

    @Test
    void shouldKeepTheResultOfAStringDataColumn() {
        JsonNode after = mapper.readTree("{\"host_id\":7,\"data\":\"[{\\\"name\\\":\\\"osquery\\\"}]\"}");

        String result = deserializer().getResult(after);

        assertThat(mapper.readTree(result).path("output").get(0).path("name").asString()).isEqualTo("osquery");
    }

    @Test
    void shouldDescribeAnErrorOfAnyType() {
        JsonNode after = mapper.readTree("{\"host_id\":7,\"error\":\"timeout\"}");

        assertThat(deserializer().getMessage(after)).contains("Query execution failed: timeout");
    }

    private FleetQueryResultEventDeserializer deserializer() {
        return new FleetQueryResultEventDeserializer(mapper, fleetMdmCacheService, null);
    }
}
