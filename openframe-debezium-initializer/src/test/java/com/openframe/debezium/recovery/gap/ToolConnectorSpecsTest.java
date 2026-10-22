package com.openframe.debezium.recovery.gap;

import com.openframe.data.document.tool.IntegratedTool;
import com.openframe.data.service.IntegratedToolService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ToolConnectorSpecsTest {

    private static final String BASE = "shared-fleet-mysql-connector";
    private static final Map<String, Object> SPEC = Map.of("name", BASE, "config", Map.of("connector.class", "mysql"));
    private static final Map<String, Object> OTHER_SPEC = Map.of("name", "other", "config", Map.of());

    @Mock private IntegratedToolService integratedToolService;

    @InjectMocks private ToolConnectorSpecs toolConnectorSpecs;

    @Test
    void specOf_enabledToolHasBase_specReturned() {
        // setup
        when(integratedToolService.getAllTools()).thenReturn(List.of(tool(true, OTHER_SPEC, SPEC)));

        // execution
        Map<String, Object> spec = toolConnectorSpecs.specOf(BASE);

        // verifications
        assertThat(spec).isEqualTo(SPEC);
    }

    @Test
    void specOf_onlyDisabledToolHasBase_throwsIllegalState() {
        // setup
        when(integratedToolService.getAllTools()).thenReturn(List.of(tool(false, SPEC)));

        // execution
        IllegalStateException ex = assertThrows(IllegalStateException.class, () -> toolConnectorSpecs.specOf(BASE));

        // verifications
        assertThat(ex.getMessage()).contains(BASE);
    }

    @Test
    void hasSpec_enabledToolHasBase_true() {
        // setup
        when(integratedToolService.getAllTools()).thenReturn(List.of(tool(true, OTHER_SPEC, SPEC)));

        // execution
        boolean hasSpec = toolConnectorSpecs.hasSpec(BASE);

        // verifications
        assertThat(hasSpec).isTrue();
    }

    @Test
    void hasSpec_noToolHasBase_false() {
        // setup
        when(integratedToolService.getAllTools()).thenReturn(List.of(tool(true, OTHER_SPEC)));

        // execution
        boolean hasSpec = toolConnectorSpecs.hasSpec(BASE);

        // verifications
        assertThat(hasSpec).isFalse();
    }

    private static IntegratedTool tool(boolean enabled, Object... specs) {
        return IntegratedTool.builder().id("tool").enabled(enabled).debeziumConnectors(specs).build();
    }
}
