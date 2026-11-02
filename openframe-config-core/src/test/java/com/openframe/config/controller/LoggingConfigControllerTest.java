package com.openframe.config.controller;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class LoggingConfigControllerTest {

    private static final String SERVER = "http://openframe-saas-config:8888";
    private static final String CLASSPATH_INCLUDE = "resource=\"logging/";

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.standaloneSetup(new LoggingConfigController()).build();
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "shared-logback-spring.xml",
            "shared-logback-spring-logfmt.xml",
            "shared-logback-spring-logfmt-shortened.xml"
    })
    void getLoggingConfig_entryPoint_includesPointAtThisServer(String filename) throws Exception {
        // execution
        String body = mockMvc.perform(get(SERVER + "/logging/" + filename))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_XML))
                .andReturn().getResponse().getContentAsString();

        // verifications
        assertThat(body)
                .contains("url=\"" + SERVER + "/logging/shared-logback-includes")
                .doesNotContain(CLASSPATH_INCLUDE);
    }

    @Test
    void getLoggingConfig_defaultHttpPort_includeUrlHasNoPort() throws Exception {
        // execution
        String body = mockMvc.perform(get("http://config/logging/shared-logback-spring.xml"))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();

        // verifications
        assertThat(body).contains("url=\"http://config/logging/shared-logback-includes.xml\"");
    }

    @Test
    void getLoggingConfig_includesFile_servedUnchanged() throws Exception {
        // execution
        String body = mockMvc.perform(get(SERVER + "/logging/shared-logback-includes.xml"))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();

        // verifications
        assertThat(body).startsWith("<?xml").contains("<included");
    }

    @ParameterizedTest
    @ValueSource(strings = {"missing.xml", "README.md", "..", "application.yml", "SHARED.XML"})
    void getLoggingConfig_notALogbackFile_notFound(String filename) throws Exception {
        // execution
        var result = mockMvc.perform(get("/logging/{filename}", filename));

        // verifications
        result.andExpect(status().isNotFound());
    }
}
