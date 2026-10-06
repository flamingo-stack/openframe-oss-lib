package com.openframe.api.controller;

import com.openframe.api.service.device.DeviceService;
import com.openframe.core.exception.BaseGlobalExceptionHandler;
import com.openframe.data.document.device.DeviceStatus;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
class DeviceControllerTest {

    @Mock
    private DeviceService deviceService;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.standaloneSetup(new DeviceController(deviceService))
                .setControllerAdvice(new BaseGlobalExceptionHandler())
                .build();
    }

    @Test
    void updateStatusIs204AndPassesMachineIdAndStatusToTheDomain() throws Exception {
        mockMvc.perform(patch("/devices/m-1").contentType(MediaType.APPLICATION_JSON).content("{\"status\":\"ARCHIVED\"}"))
                .andExpect(status().isNoContent());

        verify(deviceService).updateStatusByMachineId("m-1", DeviceStatus.ARCHIVED);
    }

    @ParameterizedTest
    @ValueSource(strings = {"{}", "{\"status\":null}"})
    void updateStatusWithoutStatusIs400AndNothingIsUpdated(String body) throws Exception {
        mockMvc.perform(patch("/devices/m-1").contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.fieldErrors[0].field").value("status"));

        verifyNoInteractions(deviceService);
    }
}
