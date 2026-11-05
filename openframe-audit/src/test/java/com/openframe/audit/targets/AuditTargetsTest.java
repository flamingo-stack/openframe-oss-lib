package com.openframe.audit.targets;

import com.openframe.data.document.audit.AuditTargetType;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.rmm.command.CommandExecution;
import com.openframe.data.document.rmm.script.ScriptExecution;
import com.openframe.data.document.ticket.Ticket;
import com.openframe.data.document.user.User;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class AuditTargetsTest {

    @Test
    void registersEveryOssTargetOnce() {
        AuditTargets targets = new AuditTargets(List.of(new OssAuditTargets()));

        assertThat(targets.find(AuditTargetType.TICKET)).hasSize(1);
        assertThat(targets.find(AuditTargetType.DEVICE)).extracting(AuditTarget::idField).containsExactly("machineId");
        assertThat(targets.find(AuditTargetType.FLEET_POLICY)).isEmpty();
    }

    @Test
    void keepsSeveralDocumentsOfOneTypeInOrder() {
        AuditTarget<ScriptExecution> scripts =
                AuditTarget.of(AuditTargetType.EXECUTION, ScriptExecution.class, ScriptExecution::getExecutionId);
        AuditTarget<CommandExecution> commands =
                AuditTarget.of(AuditTargetType.EXECUTION, CommandExecution.class, CommandExecution::getExecutionId);

        AuditTargets targets = new AuditTargets(List.of(() -> List.of(scripts, commands)));

        assertThat(targets.find(AuditTargetType.EXECUTION)).containsExactly(scripts, commands);
    }

    @Test
    void refusesTwoTargetsOfOneTypeAndDocument() {
        AuditTarget<Ticket> ticket = AuditTarget.of(AuditTargetType.TICKET, Ticket.class, Ticket::getTitle);

        assertThatThrownBy(() -> new AuditTargets(List.of(() -> List.of(ticket), () -> List.of(ticket))))
                .isInstanceOf(IllegalStateException.class);
    }

    @Test
    void readsNameCustomerAndDeviceOfADocument() {
        AuditTarget<?> device = new OssAuditTargets().targets().stream()
                .filter(target -> target.type() == AuditTargetType.DEVICE)
                .findFirst().orElseThrow();
        Machine machine = new Machine();
        machine.setHostname("LAPTOP-7F3A");
        machine.setMachineId("machine-1");
        machine.setOrganizationId("org-1");

        assertThat(device.nameOf(machine)).isEqualTo("LAPTOP-7F3A");
        assertThat(device.deviceIdOf(machine)).isEqualTo("machine-1");
        assertThat(device.organizationIdOf(machine)).isEqualTo("org-1");
    }

    @Test
    void namesAUserByFirstAndLastName() {
        AuditTarget<?> userTarget = new OssAuditTargets().targets().stream()
                .filter(target -> target.type() == AuditTargetType.USER)
                .findFirst().orElseThrow();
        User user = new User();
        user.setFirstName("Anna");
        user.setLastName("Kowalski");

        assertThat(userTarget.nameOf(user)).isEqualTo("Anna Kowalski");
        assertThat(userTarget.deviceIdOf(user)).isNull();
    }
}
