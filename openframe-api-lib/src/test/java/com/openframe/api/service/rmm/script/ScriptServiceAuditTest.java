package com.openframe.api.service.rmm.script;

import com.openframe.api.dto.rmm.script.CreateScriptInput;
import com.openframe.api.dto.rmm.script.UpdateScriptInput;
import com.openframe.api.mapper.ScriptMapper;
import com.openframe.api.service.rmm.schedule.ScheduleDeliveryRefresher;
import com.openframe.audit.AuditAspect;
import com.openframe.audit.AuditCall;
import com.openframe.audit.AuditExpressions;
import com.openframe.audit.AuditedMethodRunner;
import com.openframe.data.repository.rmm.ScriptRepository;
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

import java.util.List;
import java.util.Map;

import static com.openframe.data.document.rmm.script.OsType.MAC_OS;
import static com.openframe.data.document.rmm.script.PrivilegeLevel.ELEVATED_USER;
import static com.openframe.data.document.rmm.script.ScriptCreationSource.AI_ASSISTANT;
import static com.openframe.data.document.rmm.script.ScriptShell.BASH;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class ScriptServiceAuditTest {

    @Mock private ScriptRepository scriptRepository;
    @Mock private ScriptMapper scriptMapper;
    @Mock private TenantIdProvider tenantIdProvider;
    @Mock private ScriptTagService scriptTagService;
    @Mock private ScriptTimeoutValidator timeoutValidator;
    @Mock private ScriptPrivilegeValidator privilegeValidator;
    @Mock private ScheduleDeliveryRefresher deliveryRefresher;
    @Mock private AuditedMethodRunner auditedMethodRunner;
    @InjectMocks private ScriptService scriptService;
    @Captor private ArgumentCaptor<AuditCall> callCaptor;

    @Test
    void create_refused_namesTheEventByTheAskedName() {
        audited().create(createInput(), "user-1", AI_ASSISTANT);

        assertThat(capturedCall().targetNameOf().apply(null)).isEqualTo("Disk Usage Report");
    }

    @Test
    void create_refused_keepsTheAskedSettingsInTheDetails() {
        audited().create(createInput(), "user-1", AI_ASSISTANT);

        assertThat(capturedCall().detailsFromResult().apply(null)).containsExactlyInAnyOrderEntriesOf(Map.of(
                "creationSource", AI_ASSISTANT, "shell", BASH, "privilegeLevel", ELEVATED_USER,
                "supportedPlatforms", List.of(MAC_OS), "defaultTimeoutSeconds", 300));
    }

    @Test
    void update_refused_keepsTheAskedNameAndSettingsInTheDetails() {
        audited().update(updateInput());

        assertThat(capturedCall().detailsFromResult().apply(null)).containsExactlyInAnyOrderEntriesOf(Map.of(
                "name", "Clear Temp Files", "shell", BASH, "privilegeLevel", ELEVATED_USER,
                "supportedPlatforms", List.of(MAC_OS), "defaultTimeoutSeconds", 900));
    }

    private ScriptService audited() {
        AspectJProxyFactory proxyFactory = new AspectJProxyFactory(scriptService);
        proxyFactory.addAspect(new AuditAspect(auditedMethodRunner, new AuditExpressions(new RelayIdCodec())));
        return proxyFactory.getProxy();
    }

    private AuditCall capturedCall() {
        verify(auditedMethodRunner).run(callCaptor.capture(), any());
        return callCaptor.getValue();
    }

    private static CreateScriptInput createInput() {
        CreateScriptInput input = new CreateScriptInput();
        input.setName("Disk Usage Report");
        input.setShell(BASH);
        input.setPrivilegeLevel(ELEVATED_USER);
        input.setSupportedPlatforms(List.of(MAC_OS));
        input.setDefaultTimeoutSeconds(300);
        return input;
    }

    private static UpdateScriptInput updateInput() {
        UpdateScriptInput input = new UpdateScriptInput();
        input.setId("65f4a8000000000000000001");
        input.setName("Clear Temp Files");
        input.setShell(BASH);
        input.setPrivilegeLevel(ELEVATED_USER);
        input.setSupportedPlatforms(List.of(MAC_OS));
        input.setDefaultTimeoutSeconds(900);
        return input;
    }
}
