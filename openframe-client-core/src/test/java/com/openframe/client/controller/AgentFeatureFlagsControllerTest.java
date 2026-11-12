package com.openframe.client.controller;

import com.openframe.data.document.clientconfiguration.ClientFeatureFlag;
import com.openframe.data.service.OpenFrameClientConfigurationService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.util.Map;

import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
class AgentFeatureFlagsControllerTest {

    @Mock
    private OpenFrameClientConfigurationService openFrameClientConfigurationService;

    private MockMvc mockMvc;

    @BeforeEach
    void setup() {
        AgentFeatureFlagsController controller = new AgentFeatureFlagsController(openFrameClientConfigurationService);
        mockMvc = MockMvcBuilders.standaloneSetup(controller).build();
    }

    @Test
    void getFeatureFlags_returnsTheFlagsInTheDeliveryPayloadShape() throws Exception {
        ClientFeatureFlag flag = new ClientFeatureFlag(true, "1.6.0");
        when(openFrameClientConfigurationService.getFeatureFlags()).thenReturn(Map.of("package-auto-update", flag));

        mockMvc.perform(get("/agent/feature-flags"))
                .andExpect(status().isOk())
                .andExpect(content().json(
                        "{\"flags\":{\"package-auto-update\":{\"enabled\":true,\"minVersion\":\"1.6.0\"}}}", true));
    }

    @Test
    void getFeatureFlags_withNoFlags_returnsAnEmptyMap() throws Exception {
        when(openFrameClientConfigurationService.getFeatureFlags()).thenReturn(Map.of());

        mockMvc.perform(get("/agent/feature-flags"))
                .andExpect(status().isOk())
                .andExpect(content().json("{\"flags\":{}}", true));
    }
}
