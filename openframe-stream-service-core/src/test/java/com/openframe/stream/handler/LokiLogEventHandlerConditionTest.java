package com.openframe.stream.handler;

import com.openframe.data.loki.toolevent.LokiLogEventRepository;
import com.openframe.stream.mapping.LogEventMapper;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.json.JsonMapper;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

class LokiLogEventHandlerConditionTest {

    private final ApplicationContextRunner runner = new ApplicationContextRunner()
            .withBean(LokiLogEventRepository.class, () -> mock(LokiLogEventRepository.class))
            .withBean(ObjectMapper.class, JsonMapper::new)
            .withBean(DebeziumEventValidator.class, () -> mock(DebeziumEventValidator.class))
            .withBean(LogEventMapper.class, () -> mock(LogEventMapper.class))
            .withUserConfiguration(LokiLogEventHandler.class);

    @Test
    void storeKeyMissing_registersTheHandler() {
        runner.run(context -> assertThat(context).hasSingleBean(LokiLogEventHandler.class));
    }

    @Test
    void storeLoki_registersTheHandler() {
        runner.withPropertyValues("openframe.tool-events.store=loki")
                .run(context -> assertThat(context).hasSingleBean(LokiLogEventHandler.class));
    }

    @Test
    void storeSetToAnotherValue_leavesTheHandlerOut() {
        runner.withPropertyValues("openframe.tool-events.store=none")
                .run(context -> assertThat(context).doesNotHaveBean(LokiLogEventHandler.class));
    }
}
