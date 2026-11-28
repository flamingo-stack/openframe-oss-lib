package com.openframe.management.config.pinot;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;
import org.springframework.core.env.Environment;
import org.springframework.core.io.DefaultResourceLoader;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.HttpServerErrorException;
import org.springframework.web.client.RestTemplate;

import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.startsWith;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith({MockitoExtension.class, OutputCaptureExtension.class})
class PinotConfigInitializerTest {

    private static final String CONTROLLER = "pinot-controller:9000";
    private static final String DEVICES_SCHEMA_URL = "http://" + CONTROLLER + "/schemas/devices";
    private static final String DEVICES_FORCE_COMMIT_URL = "http://" + CONTROLLER + "/tables/devices/forceCommit";
    private static final String AUDIT_EVENTS_TABLE_URL = "http://" + CONTROLLER + "/tables/audit_events_REALTIME";
    private static final String AUDIT_EVENTS_RELOAD_URL = "http://" + CONTROLLER + "/segments/audit_events_REALTIME/reload";
    private static final Pattern PLACEHOLDER = Pattern.compile("\\$\\{([^}:]+)(:[^}]*)?}");
    private static final Map<String, String> TABLE_NAMES = Map.of(
            "pinot.tables.devices.name", "devices",
            "pinot.tables.logs.name", "logs",
            "pinot.tables.audit-events.name", "audit_events");

    @Mock
    private RestTemplate restTemplate;

    @Mock
    private Environment environment;

    private PinotConfigInitializer initializer;

    @BeforeEach
    void setUp() {
        initializer = new PinotConfigInitializer(new DefaultResourceLoader(), environment, restTemplate);
        ReflectionTestUtils.setField(initializer, "pinotControllerUrl", CONTROLLER);
        ReflectionTestUtils.setField(initializer, "pinotConfigEnabled", true);
        ReflectionTestUtils.setField(initializer, "maxRetries", 1);
        ReflectionTestUtils.setField(initializer, "retryDelayMs", 0L);
        when(environment.resolveRequiredPlaceholders(anyString())).thenAnswer(invocation -> resolve(invocation.getArgument(0)));
        lenient().when(restTemplate.exchange(anyString(), any(HttpMethod.class), any(HttpEntity.class), eq(String.class)))
                .thenReturn(ResponseEntity.ok("{}"));
    }

    @Test
    void init_storedDevicesSchemaLacksAColumn_forceCommitsTheConsumingSegments() {
        // setup
        storedDevicesSchema("""
                {"schemaName": "devices", "dimensionFieldSpecs": [{"name": "machineId", "dataType": "STRING"}]}""");

        // execution
        initializer.init();

        // verifications
        verify(restTemplate).exchange(eq(DEVICES_FORCE_COMMIT_URL), eq(HttpMethod.POST), any(HttpEntity.class), eq(String.class));
    }

    @Test
    void init_storedDevicesSchemaHasTheSameColumns_noForceCommit() {
        // setup
        storedDevicesSchema(resolve(resource("schema-devices.json")));

        // execution
        initializer.init();

        // verifications
        verify(restTemplate, never()).exchange(eq(DEVICES_FORCE_COMMIT_URL), any(HttpMethod.class), any(HttpEntity.class), eq(String.class));
    }

    @Test
    void init_devicesSchemaNewToTheController_noForceCommit() {
        // setup
        when(restTemplate.exchange(eq(DEVICES_SCHEMA_URL), eq(HttpMethod.GET), any(HttpEntity.class), eq(String.class)))
                .thenThrow(HttpClientErrorException.create(HttpStatus.NOT_FOUND, "Not Found", null, null, null));

        // execution
        initializer.init();

        // verifications
        verify(restTemplate, never()).exchange(eq(DEVICES_FORCE_COMMIT_URL), any(HttpMethod.class), any(HttpEntity.class), eq(String.class));
    }

    @Test
    void init_storedSchemaUnreadable_treatedAsChangedAndForceCommitted() {
        // setup
        when(restTemplate.exchange(eq(DEVICES_SCHEMA_URL), eq(HttpMethod.GET), any(HttpEntity.class), eq(String.class)))
                .thenThrow(HttpServerErrorException.create(HttpStatus.INTERNAL_SERVER_ERROR, "boom", null, null, null));

        // execution
        initializer.init();

        // verifications
        verify(restTemplate).exchange(eq(DEVICES_FORCE_COMMIT_URL), eq(HttpMethod.POST), any(HttpEntity.class), eq(String.class));
    }

    @Test
    void init_forceCommitFails_startupContinuesWithTheNextTable() {
        // setup
        storedDevicesSchema("""
                {"schemaName": "devices", "dimensionFieldSpecs": [{"name": "machineId", "dataType": "STRING"}]}""");
        when(restTemplate.exchange(eq(DEVICES_FORCE_COMMIT_URL), eq(HttpMethod.POST), any(HttpEntity.class), eq(String.class)))
                .thenThrow(HttpServerErrorException.create(HttpStatus.INTERNAL_SERVER_ERROR, "boom", null, null, null));

        // execution
        assertThatCode(() -> initializer.init()).doesNotThrowAnyException();

        // verifications
        verify(restTemplate).exchange(startsWith("http://" + CONTROLLER + "/segments/logs"), eq(HttpMethod.POST),
                any(HttpEntity.class), eq(String.class));
    }

    @Test
    void init_forceCommitAnswersAccepted_loggedAsForced(CapturedOutput output) {
        // setup
        storedDevicesSchema("""
                {"schemaName": "devices", "dimensionFieldSpecs": [{"name": "machineId", "dataType": "STRING"}]}""");
        when(restTemplate.exchange(eq(DEVICES_FORCE_COMMIT_URL), eq(HttpMethod.POST), any(HttpEntity.class), eq(String.class)))
                .thenReturn(ResponseEntity.accepted().body("{\"forceCommitStatus\": \"SUCCESS\"}"));

        // execution
        initializer.init();

        // verifications
        assertThat(output).contains("Forced commit of the consuming segments of devices")
                .doesNotContain("Force commit of the consuming segments of devices answered");
    }

    @Test
    void init_auditOn_deploysTheAuditEventsTable() {
        ReflectionTestUtils.setField(initializer, "auditEnabled", true);

        initializer.init();

        verify(restTemplate).exchange(eq(AUDIT_EVENTS_TABLE_URL), eq(HttpMethod.PUT), any(HttpEntity.class), eq(String.class));
    }

    @Test
    void init_newTableWithNoSegmentsYet_deploymentCompletes(CapturedOutput output) {
        ReflectionTestUtils.setField(initializer, "auditEnabled", true);
        when(restTemplate.exchange(eq(AUDIT_EVENTS_RELOAD_URL), eq(HttpMethod.POST), any(HttpEntity.class), eq(String.class)))
                .thenThrow(HttpClientErrorException.create(HttpStatus.NOT_FOUND, "Not Found", null,
                        "{\"code\":404,\"error\":\"Failed to find any segments in table: audit_events_REALTIME on every instance\"}"
                                .getBytes(), null));

        initializer.init();

        assertThat(output).contains("Pinot configuration deployment completed successfully")
                .doesNotContain("Pinot configuration deployment FAILED");
    }

    @Test
    void init_auditOff_deploysNoAuditEventsTable() {
        ReflectionTestUtils.setField(initializer, "auditEnabled", false);

        initializer.init();

        verify(restTemplate, never()).exchange(eq(AUDIT_EVENTS_TABLE_URL), any(HttpMethod.class), any(HttpEntity.class),
                eq(String.class));
    }

    private void storedDevicesSchema(String body) {
        when(restTemplate.exchange(eq(DEVICES_SCHEMA_URL), eq(HttpMethod.GET), any(HttpEntity.class), eq(String.class)))
                .thenReturn(ResponseEntity.ok(body));
    }

    private static String resource(String name) {
        try (var in = new DefaultResourceLoader().getResource("classpath:pinot/config/" + name).getInputStream()) {
            return new String(in.readAllBytes());
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    private static String resolve(String config) {
        Matcher matcher = PLACEHOLDER.matcher(config);
        StringBuilder resolved = new StringBuilder();
        while (matcher.find()) {
            matcher.appendReplacement(resolved, TABLE_NAMES.getOrDefault(matcher.group(1), "1"));
        }
        matcher.appendTail(resolved);
        return resolved.toString();
    }
}
