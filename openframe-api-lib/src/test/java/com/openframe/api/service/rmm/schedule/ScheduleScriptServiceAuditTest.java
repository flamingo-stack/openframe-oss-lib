package com.openframe.api.service.rmm.schedule;

import com.openframe.api.dto.rmm.schedule.CreateScriptScheduleInput;
import com.openframe.api.dto.rmm.schedule.UpdateScriptScheduleInput;
import com.openframe.api.mapper.ScriptScheduleMapper;
import com.openframe.api.service.rmm.script.ScriptService;
import com.openframe.audit.AuditAspect;
import com.openframe.audit.AuditCall;
import com.openframe.audit.AuditExpressions;
import com.openframe.audit.AuditedMethodRunner;
import com.openframe.data.repository.rmm.DeviceOnlineDispatchRepository;
import com.openframe.data.repository.rmm.ScheduleDeviceLocalDispatchRepository;
import com.openframe.data.repository.rmm.ScriptScheduleRepository;
import com.openframe.data.service.TenantIdProvider;
import com.openframe.graphql.relay.RelayIdCodec;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.aop.aspectj.annotation.AspectJProxyFactory;

import java.time.Instant;
import java.util.List;
import java.util.Map;

import static com.openframe.data.document.rmm.schedule.ScheduleOfflineBehavior.RETRY_ON_RECONNECT;
import static com.openframe.data.document.rmm.schedule.ScheduleScriptTrigger.DATE_TIME;
import static com.openframe.data.document.rmm.schedule.ScheduleTimeReference.DEVICE_LOCAL;
import static com.openframe.data.document.rmm.script.OsType.WINDOWS;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class ScheduleScriptServiceAuditTest {

    private static final Instant START_AT = Instant.parse("2026-09-15T02:07:00Z");
    private static final List<String> SCRIPT_IDS = List.of("script-1", "script-2");

    @Mock private ScriptScheduleRepository scheduleRepository;
    @Mock private ScriptScheduleMapper scheduleMapper;
    @Mock private ScriptService scriptService;
    @Mock private TenantIdProvider tenantIdProvider;
    @Mock private ScheduleDeviceLocalDispatchRepository deviceLocalDispatchRepository;
    @Mock private DeviceOnlineDispatchRepository onlineDeviceDispatchRepository;
    @Mock private ScheduleDeliveryRefresher deliveryRefresher;
    @Mock private AuditedMethodRunner auditedMethodRunner;
    @InjectMocks private ScheduleScriptService scheduleScriptService;
    @Captor private ArgumentCaptor<AuditCall> callCaptor;

    @Test
    void create_refused_namesTheEventByTheAskedName() {
        audited().create(createInput(), "user-1");

        assertThat(capturedCall().targetNameOf().apply(null)).isEqualTo("Nightly Maintenance");
    }

    @Test
    void create_refused_keepsTheAskedSettingsInTheDetails() {
        audited().create(createInput(), "user-1");

        assertThat(capturedCall().detailsFromResult().apply(null)).containsExactlyInAnyOrderEntriesOf(Map.of(
                "startAt", START_AT, "repeat", 1800L, "trigger", DATE_TIME, "scriptIds", SCRIPT_IDS,
                "supportedPlatforms", List.of(WINDOWS), "offlineBehavior", RETRY_ON_RECONNECT,
                "reconnectWindowSeconds", 600L, "timeReference", DEVICE_LOCAL));
    }

    @Test
    void update_refused_keepsTheAskedNameAndSettingsInTheDetails() {
        audited().update(updateInput());

        assertThat(capturedCall().detailsFromResult().apply(null)).containsExactlyInAnyOrderEntriesOf(Map.of(
                "name", "Weekly Cleanup", "startAt", START_AT, "repeat", 1000L, "trigger", DATE_TIME,
                "scriptIds", SCRIPT_IDS, "supportedPlatforms", List.of(WINDOWS), "offlineBehavior", RETRY_ON_RECONNECT,
                "reconnectWindowSeconds", 600L, "timeReference", DEVICE_LOCAL));
    }

    private ScheduleScriptService audited() {
        AspectJProxyFactory proxyFactory = new AspectJProxyFactory(scheduleScriptService);
        proxyFactory.addAspect(new AuditAspect(auditedMethodRunner, new AuditExpressions(new RelayIdCodec())));
        return proxyFactory.getProxy();
    }

    private AuditCall capturedCall() {
        verify(auditedMethodRunner).run(callCaptor.capture(), any());
        return callCaptor.getValue();
    }

    private static CreateScriptScheduleInput createInput() {
        CreateScriptScheduleInput input = new CreateScriptScheduleInput();
        input.setName("Nightly Maintenance");
        input.setStartAt(START_AT);
        input.setRepeat(1800L);
        input.setTrigger(DATE_TIME);
        input.setScriptIds(SCRIPT_IDS);
        input.setSupportedPlatforms(List.of(WINDOWS));
        input.setOfflineBehavior(RETRY_ON_RECONNECT);
        input.setReconnectWindowSeconds(600L);
        input.setTimeReference(DEVICE_LOCAL);
        return input;
    }

    private static UpdateScriptScheduleInput updateInput() {
        UpdateScriptScheduleInput input = new UpdateScriptScheduleInput();
        input.setId("65f4a8000000000000000001");
        input.setName("Weekly Cleanup");
        input.setStartAt(START_AT);
        input.setRepeat(1000L);
        input.setTrigger(DATE_TIME);
        input.setScriptIds(SCRIPT_IDS);
        input.setSupportedPlatforms(List.of(WINDOWS));
        input.setOfflineBehavior(RETRY_ON_RECONNECT);
        input.setReconnectWindowSeconds(600L);
        input.setTimeReference(DEVICE_LOCAL);
        return input;
    }
}
