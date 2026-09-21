package com.openframe.api.service.rmm.software;

import com.openframe.api.dto.rmm.script.ScriptResponse;
import com.openframe.api.service.device.DeviceService;
import com.openframe.api.service.rmm.script.ScriptExecutionService;
import com.openframe.core.exception.BadRequestException;
import com.openframe.data.document.packagesearch.PackageManagerType;
import com.openframe.data.document.rmm.script.ExecutionSource;
import com.openframe.data.document.rmm.script.PrivilegeLevel;
import com.openframe.data.document.rmm.script.ScriptShell;
import com.openframe.data.document.rmm.software.SoftwareAction;
import com.openframe.data.nats.rmm.model.ScriptMessage;
import com.openframe.data.nats.rmm.publisher.SoftwareNatsPublisher;
import com.openframe.data.nats.rmm.util.ScriptArgsTokenizer;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class SoftwareDispatchServiceTest {

    private static final String USER = "user-1";

    @Mock private DeviceService deviceService;
    @Mock private ScriptExecutionService scriptExecutionService;
    @Mock private SoftwareNatsPublisher softwareNatsPublisher;

    @org.mockito.InjectMocks private SoftwareDispatchService service;

    @Test
    @DisplayName("persists RUNNING batch rows and fans one software message per machine, shared executionId")
    void dispatch_persistsAndFansOut() {
        ScriptResponse script = brewInstall();

        String executionId = service.dispatch(script, List.of("m1", "m2"),
                List.of("--cask", "slack"), USER, ExecutionSource.MANUAL,
                PackageManagerType.BREW, "slack", SoftwareAction.INSTALL);

        assertThat(executionId).isNotBlank();
        verify(deviceService).verifyDispatchable(List.of("m1", "m2"));

        verify(scriptExecutionService).createSoftwareBatch(eq(executionId), eq("brew-install-id"),
                eq(List.of("m1", "m2")), eq(PrivilegeLevel.ADMIN), eq(600), eq(USER), eq(ExecutionSource.MANUAL),
                eq(PackageManagerType.BREW), eq("slack"), eq(SoftwareAction.INSTALL));

        ArgumentCaptor<ScriptMessage> msgCaptor = ArgumentCaptor.forClass(ScriptMessage.class);
        verify(softwareNatsPublisher, times(2)).publishSoftware(any(), msgCaptor.capture());
        assertThat(msgCaptor.getAllValues()).allSatisfy(m -> {
            assertThat(m.getExecutionId()).isEqualTo(executionId);
            assertThat(m.getScriptId()).isEqualTo("brew-install-id");
            assertThat(m.getCode()).isEqualTo("brew install \"$@\"");
            assertThat(m.getShell()).isEqualTo(ScriptShell.BASH);
            assertThat(m.getPrivilegeLevel()).isEqualTo(PrivilegeLevel.ADMIN);
            assertThat(m.getArgs()).isEqualTo(ScriptArgsTokenizer.tokenize(List.of("--cask", "slack")));
        });
        assertThat(msgCaptor.getAllValues()).extracting(ScriptMessage::getMachineId)
                .containsExactlyInAnyOrder("m1", "m2");
    }

    @Test
    @DisplayName("a machine the dispatch guard rejects fails the whole dispatch — nothing persisted or published")
    void dispatch_rejectsBadMachine() {
        doThrow(new BadRequestException("Machine is not in a dispatchable state (must be ONLINE or OFFLINE): m1"))
                .when(deviceService).verifyDispatchable(anyList());

        assertThatThrownBy(() -> service.dispatch(brewInstall(), List.of("m1"),
                List.of("slack"), USER, ExecutionSource.MANUAL,
                PackageManagerType.BREW, "slack", SoftwareAction.INSTALL))
                .isInstanceOf(BadRequestException.class);

        verify(scriptExecutionService, never()).createSoftwareBatch(any(), any(), anyList(), any(), any(), any(), any(), any(), any(), any());
        verify(softwareNatsPublisher, never()).publishSoftware(any(), any());
    }

    private static ScriptResponse brewInstall() {
        return ScriptResponse.builder()
                .id("brew-install-id")
                .scriptBody("brew install \"$@\"")
                .shell(ScriptShell.BASH)
                .privilegeLevel(PrivilegeLevel.ADMIN)
                .defaultTimeoutSeconds(600)
                .build();
    }
}
