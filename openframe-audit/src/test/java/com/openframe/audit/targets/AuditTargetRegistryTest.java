package com.openframe.audit.targets;

import com.openframe.data.document.audit.AuditTargetType;
import com.openframe.data.document.rmm.command.CommandExecution;
import com.openframe.data.document.rmm.script.ScriptExecution;
import com.openframe.data.document.ticket.Ticket;
import com.openframe.data.document.user.User;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class AuditTargetRegistryTest {

    @Test
    void find_targetsOfTwoProviders_returnsTheTargetOfEachProvider() {
        AuditTarget<Ticket> ticket = AuditTarget.of(AuditTargetType.TICKET, Ticket.class, Ticket::getTitle);
        AuditTarget<User> user = AuditTarget.of(AuditTargetType.USER, User.class, User::getEmail);

        AuditTargetRegistry targets = new AuditTargetRegistry(List.of(() -> List.of(ticket), () -> List.of(user)));

        assertThat(targets.find(AuditTargetType.TICKET)).containsExactly(ticket);
        assertThat(targets.find(AuditTargetType.USER)).containsExactly(user);
    }

    @Test
    void find_severalDocumentsOfOneType_returnsThemInRegistrationOrder() {
        AuditTarget<ScriptExecution> scripts =
                AuditTarget.of(AuditTargetType.EXECUTION, ScriptExecution.class, ScriptExecution::getExecutionId);
        AuditTarget<CommandExecution> commands =
                AuditTarget.of(AuditTargetType.EXECUTION, CommandExecution.class, CommandExecution::getExecutionId);

        AuditTargetRegistry targets = new AuditTargetRegistry(List.of(() -> List.of(scripts, commands)));

        assertThat(targets.find(AuditTargetType.EXECUTION)).containsExactly(scripts, commands);
    }
}
