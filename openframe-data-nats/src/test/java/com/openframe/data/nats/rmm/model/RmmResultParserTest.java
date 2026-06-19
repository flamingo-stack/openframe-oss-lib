package com.openframe.data.nats.rmm.model;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class RmmResultParserTest {

    private RmmResultParser parser;

    @BeforeEach
    void setUp() {
        parser = new RmmResultParser(new ObjectMapper());
    }

    @Test
    @DisplayName("parse(CommandResultMessage.class): snake_case agent payload deserializes into a CommandResultMessage with camelCase fields")
    void parse_commandResultMessage() throws Exception {
        byte[] payload = ("{\"execution_id\":\"exec-1\",\"machine_id\":\"machine-42\","
                + "\"stdout\":\"hey\\n\",\"stderr\":\"\",\"exit_code\":0,"
                + "\"execution_time_ms\":12,\"timed_out\":false}").getBytes(StandardCharsets.UTF_8);

        CommandResultMessage parsed = parser.parse(payload, CommandResultMessage.class);

        assertThat(parsed).isInstanceOf(CommandResultMessage.class);
        assertThat(parsed.getExecutionId()).isEqualTo("exec-1");
        assertThat(parsed.getMachineId()).isEqualTo("machine-42");
        assertThat(parsed.getStdout()).isEqualTo("hey\n");
        assertThat(parsed.getExitCode()).isZero();
        assertThat(parsed.getExecutionTimeMs()).isEqualTo(12L);
        assertThat(parsed.getTimedOut()).isFalse();
    }

    @Test
    @DisplayName("parse(ScriptResultMessage.class): the SAME wire payload deserializes into a ScriptResultMessage when that target type is requested — parsing is shared, the Java type is the only difference")
    void parse_scriptResultMessage_sameWireSameFields() throws Exception {
        byte[] payload = ("{\"execution_id\":\"exec-1\",\"exit_code\":0,\"timed_out\":false}")
                .getBytes(StandardCharsets.UTF_8);

        ScriptResultMessage parsed = parser.parse(payload, ScriptResultMessage.class);

        assertThat(parsed).isInstanceOf(ScriptResultMessage.class);
        assertThat(parsed.getExecutionId()).isEqualTo("exec-1");
        assertThat(parsed.getExitCode()).isZero();
        assertThat(parsed.getTimedOut()).isFalse();
    }

    @Test
    @DisplayName("parse: unknown JSON fields are tolerated (forward-compatible wire) — keeps the agent free to evolve without breaking older backend deployments")
    void parse_ignoresUnknownFields() throws Exception {
        byte[] payload = "{\"execution_id\":\"exec-9\",\"future_field\":\"x\",\"another_new\":42}"
                .getBytes(StandardCharsets.UTF_8);

        CommandResultMessage parsed = parser.parse(payload, CommandResultMessage.class);

        assertThat(parsed.getExecutionId()).isEqualTo("exec-9");
    }

    @Test
    @DisplayName("parse: malformed JSON propagates an IOException — listeners are expected to catch it and keep the core-NATS dispatcher alive")
    void parse_malformedThrows() {
        byte[] payload = "not-json".getBytes(StandardCharsets.UTF_8);

        assertThatThrownBy(() -> parser.parse(payload, CommandResultMessage.class))
                .isInstanceOf(java.io.IOException.class);
    }
}
