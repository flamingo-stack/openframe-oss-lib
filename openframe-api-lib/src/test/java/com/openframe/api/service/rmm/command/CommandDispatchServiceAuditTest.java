package com.openframe.api.service.rmm.command;

import com.openframe.api.dto.command.BatchRunCommandInput;
import com.openframe.api.dto.command.CancelExecutionInput;
import com.openframe.audit.AuditAspect;
import com.openframe.audit.AuditCall;
import com.openframe.audit.AuditExpressions;
import com.openframe.audit.AuditedMethodRunner;
import com.openframe.data.document.rmm.script.ScriptExecution;
import com.openframe.data.repository.rmm.CommandExecutionRepository;
import com.openframe.data.repository.rmm.ScriptExecutionRepository;
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
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CommandDispatchServiceAuditTest {

    private static final String MACHINE_ID = "machine-1";
    private static final String EXECUTION_ID = "exec-1";

    @Mock private ScriptExecutionRepository scriptExecutionRepository;
    @Mock private CommandExecutionRepository commandExecutionRepository;
    @Mock private AuditedMethodRunner auditedMethodRunner;
    @InjectMocks private CommandDispatchService commandDispatchService;
    @Captor private ArgumentCaptor<AuditCall> callCaptor;

    @Test
    void cancelExecution_severalScriptRuns_targetsTheRunId() {
        when(scriptExecutionRepository.findAllByMachineIdAndExecutionId(MACHINE_ID, EXECUTION_ID)).thenReturn(List.of(
                ScriptExecution.builder().id("script-row-1").build(),
                ScriptExecution.builder().id("script-row-2").build()));

        commandDispatchService.cancelExecution(cancelInput());

        assertThat(capturedCall().targetIdBeforeCall().get()).isEqualTo(EXECUTION_ID);
    }

    @Test
    void cancelExecution_noRunRecord_targetsTheRunId() {
        when(scriptExecutionRepository.findAllByMachineIdAndExecutionId(MACHINE_ID, EXECUTION_ID)).thenReturn(List.of());
        when(commandExecutionRepository.findByMachineIdAndExecutionId(MACHINE_ID, EXECUTION_ID))
                .thenReturn(Optional.empty());

        commandDispatchService.cancelExecution(cancelInput());

        assertThat(capturedCall().targetIdBeforeCall().get()).isEqualTo(EXECUTION_ID);
    }

    @Test
    void batchRunCommand_oneDevice_targetsThatDevice() {
        audited().batchRunCommand(batchInput(List.of(MACHINE_ID)), "user-1");

        assertThat(capturedCall().targetIdBeforeCall().get()).isEqualTo(MACHINE_ID);
    }

    @Test
    void batchRunCommand_severalDevices_targetsNoDevice() {
        audited().batchRunCommand(batchInput(List.of(MACHINE_ID, "machine-2")), "user-1");

        assertThat(capturedCall().targetIdBeforeCall().get()).isNull();
    }

    private CommandDispatchService audited() {
        AspectJProxyFactory proxyFactory = new AspectJProxyFactory(commandDispatchService);
        proxyFactory.addAspect(new AuditAspect(auditedMethodRunner, new AuditExpressions(new RelayIdCodec())));
        return proxyFactory.getProxy();
    }

    private AuditCall capturedCall() {
        verify(auditedMethodRunner).run(callCaptor.capture(), any());
        return callCaptor.getValue();
    }

    private static BatchRunCommandInput batchInput(List<String> machineIds) {
        BatchRunCommandInput input = new BatchRunCommandInput();
        input.setMachineIds(machineIds);
        return input;
    }

    private static CancelExecutionInput cancelInput() {
        CancelExecutionInput input = new CancelExecutionInput();
        input.setMachineId(MACHINE_ID);
        input.setExecutionId(EXECUTION_ID);
        return input;
    }
}
